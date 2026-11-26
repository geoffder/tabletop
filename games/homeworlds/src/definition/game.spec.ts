import { describe, expect, it } from 'vitest'
import { assert, type GameAction, GameResult } from '@tabletop/common'
import { FirstPlayer, firstPlayerFromConfig, Setup, setupFromConfig } from './config.js'
import { MachineState } from './states.js'
import { ActionType } from './actions.js'
import {
    EndReason,
    HomeworldsGameStateValidator,
    HydratedHomeworldsGameState,
    type HomeworldsGameState
} from '../model/gameState.js'
import {
    type PieceKind,
    PIECE_COUNT,
    pieceColor,
    piecesOfKind,
    pieceSize,
    PyramidColor,
    PyramidSize
} from '../model/pieces.js'
import { HOMEWORLD_SYSTEM_IDS, type StarSystem } from '../model/starMap.js'
import { Power } from '../model/powers.js'
import type { CreateHomeworld } from '../actions/createHomeworld.js'
import type { Sacrifice } from '../actions/sacrifice.js'
import type { Catastrophe } from '../actions/catastrophe.js'
import { type EndTurn, isEndTurn } from '../actions/endTurn.js'
import { HomeworldsRuntime } from './runtime.js'
import {
    actionBase as base,
    createGame as createTestGame,
    engine,
    execute,
    legalActions,
    MASTER_SEED,
    playToEnd,
    powerAction,
    type HomeworldsConfig,
    type HomeworldsGame
} from './tests/playthrough.js'

const A = 'first'
const B = 'second'
const [HOME_A, HOME_B] = HOMEWORLD_SYSTEM_IDS

function createGame(config: HomeworldsConfig = {}) {
    return createTestGame(config, [A, B])
}

function start(game: HomeworldsGame): HomeworldsGameState {
    return engine.startGame(game, { startingPositions: { playerIds: [A, B] } }).initialState
}

const COLOR_CODES: Record<string, PyramidColor> = {
    r: PyramidColor.Red,
    y: PyramidColor.Yellow,
    g: PyramidColor.Green,
    b: PyramidColor.Blue
}

type Layout = { home?: string; id?: number; stars: string[]; ships?: [string, string][] }

// Lays out systems from short piece names: 'g3' is a Large green, owners by player id. Basic
// systems take their star's id; homeworlds the seat's id. Player A is to take a turn.
function position(layout: Layout[], machineState = MachineState.TakingTurn): HomeworldsGameState {
    const game = createGame({ setup: Setup.FirstGame })
    const state = start(game)
    const used = new Set<number>()
    const take = (code: string) => {
        const color = COLOR_CODES[code[0] ?? '']
        assert(color !== undefined, `Bad piece ${code}`)
        const piece = piecesOfKind({ color, size: Number(code[1]) }).find((id) => !used.has(id))
        assert(piece !== undefined, `No ${code} left`)
        used.add(piece)
        return piece
    }
    state.starMap.systems = layout.map((system): StarSystem => {
        const stars = system.stars.map(take)
        const ships = (system.ships ?? []).map(([code, ownerId]) => ({
            piece: take(code),
            ownerId
        }))
        const id = system.home === A ? HOME_A : system.home === B ? HOME_B : (system.id ?? stars[0])
        assert(id !== undefined, 'A system needs an id')
        return { id, stars, ships, ...(system.home ? { homeworldOf: system.home } : {}) }
    })
    state.machineState = machineState
    state.positions = []
    return state
}

const gameFor = () => createGame({ setup: Setup.FirstGame })

function act(state: HomeworldsGameState, action: GameAction) {
    return execute(gameFor(), state, action)
}

function hydrate(state: HomeworldsGameState) {
    return new HydratedHomeworldsGameState(state)
}

const shipAt = (state: HomeworldsGameState, systemId: number, code: string, ownerId: string) => {
    const system = state.starMap.systems.find((candidate) => candidate.id === systemId)
    const color = COLOR_CODES[code[0] ?? '']
    const ship = system?.ships.find(
        (candidate) =>
            candidate.ownerId === ownerId &&
            pieceColor(candidate.piece) === color &&
            pieceSize(candidate.piece) === Number(code[1])
    )
    assert(ship !== undefined, `No ${code} of ${ownerId} at ${systemId}`)
    return ship.piece
}

const system = (state: HomeworldsGameState, id: number) =>
    state.starMap.systems.find((candidate) => candidate.id === id)

const g = gameFor()
const homeworld = (
    game: HomeworldsGame,
    playerId: string,
    stars: PieceKind[],
    shipColor: PyramidColor
): CreateHomeworld => ({
    ...base(game, playerId),
    type: ActionType.CreateHomeworld,
    stars,
    shipColor
})
const endTurn = (playerId = A): EndTurn => ({ ...base(g, playerId), type: ActionType.EndTurn })
const build = (systemId: number, color: PyramidColor, playerId = A) =>
    powerAction(g, playerId, { power: Power.Build, systemId, color })
const move = (ship: number, systemId: number, playerId = A) =>
    powerAction(g, playerId, { power: Power.Move, ship, systemId })
const discover = (ship: number, color: PyramidColor, size: PyramidSize, playerId = A) =>
    powerAction(g, playerId, { power: Power.Discover, ship, star: { color, size } })
const capture = (ship: number, playerId = A) =>
    powerAction(g, playerId, { power: Power.Capture, ship })
const trade = (ship: number, color: PyramidColor, playerId = A) =>
    powerAction(g, playerId, { power: Power.Trade, ship, color })
const sacrifice = (ship: number, playerId = A): Sacrifice => ({
    ...base(g, playerId),
    type: ActionType.Sacrifice,
    ship
})
const catastrophe = (systemId: number, color: PyramidColor, playerId = A): Catastrophe => ({
    ...base(g, playerId),
    type: ActionType.Catastrophe,
    systemId,
    color
})

// Homeworlds that keep both players safe, so turns go on: A is Small/Medium, B Large/Small.
const HOMES: Layout[] = [
    { home: A, stars: ['b1', 'r2'], ships: [['g3', A]] },
    { home: B, stars: ['y3', 'b1'], ships: [['g3', B]] }
]

describe('Setup', () => {
    it('lets the first player build a homeworld, then the second, then starts the first', () => {
        const game = createGame()
        let state = start(game)
        expect(state.machineState).toBe(MachineState.SettingUp)
        expect(state.activePlayerIds).toEqual([A])
        state = execute(
            game,
            state,
            homeworld(
                game,
                A,
                [
                    { color: PyramidColor.Blue, size: PyramidSize.Small },
                    { color: PyramidColor.Red, size: PyramidSize.Medium }
                ],
                PyramidColor.Green
            )
        )
        expect(state.machineState).toBe(MachineState.SettingUp)
        expect(state.activePlayerIds).toEqual([B])
        state = execute(
            game,
            state,
            homeworld(
                game,
                B,
                [
                    { color: PyramidColor.Yellow, size: PyramidSize.Large },
                    { color: PyramidColor.Blue, size: PyramidSize.Small }
                ],
                PyramidColor.Green
            )
        )
        expect(state.machineState).toBe(MachineState.TakingTurn)
        expect(state.activePlayerIds).toEqual([A])
        const home = system(state, HOME_A)
        expect(home?.homeworldOf).toBe(A)
        expect(home?.ships.map((ship) => pieceSize(ship.piece))).toEqual([PyramidSize.Large])
    })

    it('allows a Gemini homeworld and the same sizes as the opponent', () => {
        const game = createGame()
        let state = start(game)
        const gemini = [
            { color: PyramidColor.Blue, size: PyramidSize.Small },
            { color: PyramidColor.Red, size: PyramidSize.Small }
        ]
        state = execute(game, state, homeworld(game, A, gemini, PyramidColor.Green))
        state = execute(game, state, homeworld(game, B, gemini, PyramidColor.Yellow))
        expect(state.machineState).toBe(MachineState.TakingTurn)
    })

    it('rejects a homeworld the Bank cannot supply', () => {
        const game = createGame()
        let state = start(game)
        const larges = [
            { color: PyramidColor.Green, size: PyramidSize.Large },
            { color: PyramidColor.Green, size: PyramidSize.Large }
        ]
        state = execute(game, state, homeworld(game, A, larges, PyramidColor.Green))
        expect(() =>
            execute(
                game,
                state,
                homeworld(
                    game,
                    B,
                    [larges[0], { color: PyramidColor.Red, size: PyramidSize.Small }],
                    PyramidColor.Blue
                )
            )
        ).toThrow()
    })

    it("starts from the rulebook's first-game setup when chosen", () => {
        const state = start(gameFor())
        expect(state.machineState).toBe(MachineState.TakingTurn)
        expect(state.activePlayerIds).toEqual([A])
        const kinds = (id: number) =>
            system(state, id)?.stars.map((star) => `${pieceColor(star)}${pieceSize(star)}`)
        expect(kinds(HOME_A)).toEqual(['blue3', 'red1'])
        expect(kinds(HOME_B)).toEqual(['red2', 'blue1'])
        for (const id of [HOME_A, HOME_B]) {
            const ships = system(state, id)?.ships ?? []
            expect(
                ships.map((ship) => `${pieceColor(ship.piece)}${pieceSize(ship.piece)}`)
            ).toEqual(['green3'])
        }
    })
})

describe('Connections', () => {
    it('joins systems only when no star size is shared', () => {
        const state = hydrate(
            position([
                ...HOMES,
                { stars: ['g3'], ships: [['y1', A]] },
                { stars: ['r3'], ships: [['y1', B]] },
                { stars: ['y2'], ships: [['r1', B]] }
            ])
        )
        const [, , g3, r3, y2] = state.starMap.systems.map((s) => s.id)
        const ids = (from: number | undefined) =>
            state.starMap
                .connectedSystems(from ?? -1)
                .map((other) => other.id)
                .toSorted((a, b) => a - b)
        const sorted = (...list: (number | undefined)[]) =>
            list.toSorted((a, b) => (a ?? 0) - (b ?? 0))
        // A's homeworld is Small and Medium: only Large stars join it.
        expect(ids(HOME_A)).toEqual(sorted(g3, r3))
        // Two Large stars are not joined; the Medium joins both.
        expect(ids(g3)).toEqual(sorted(HOME_A, y2))
        // B's homeworld is Large and Small: only the Medium joins it.
        expect(ids(HOME_B)).toEqual([y2])
    })
})

describe('Basic actions', () => {
    it('builds the smallest of a colour only where the player has green and a ship of it', () => {
        const state = position([...HOMES, { stars: ['r3'], ships: [['y1', A]] }])
        const after = act(state, build(HOME_A, PyramidColor.Green))
        const built = system(after, HOME_A)?.ships.at(-1)
        expect(built && `${pieceColor(built.piece)}${pieceSize(built.piece)}`).toBe('green1')
        expect(after.activePlayerIds).toEqual([B])
        // No green at the Large red star.
        const r3 = state.starMap.systems[2]?.id ?? -1
        expect(() => act(state, build(r3, PyramidColor.Yellow))).toThrow()
        // Green from the star, but no ship of the colour asked for.
        const greenStar = position([...HOMES, { stars: ['g2'], ships: [['y1', A]] }])
        const g2 = greenStar.starMap.systems[2]?.id ?? -1
        expect(() => act(greenStar, build(g2, PyramidColor.Red))).toThrow()
        expect(system(act(greenStar, build(g2, PyramidColor.Yellow)), g2)?.ships).toHaveLength(2)
    })

    it("never uses the colour of the opponent's ship", () => {
        const state = position([
            ...HOMES,
            {
                stars: ['r3'],
                ships: [
                    ['b1', A],
                    ['g1', B]
                ]
            }
        ])
        const r3 = state.starMap.systems[2].id
        expect(() => act(state, build(r3, PyramidColor.Blue))).toThrow()
    })

    it('moves only to a connected system and discovers only a star of a new size', () => {
        const state = position([
            ...HOMES,
            { stars: ['y2'], ships: [['g1', A]] },
            { stars: ['b2'], ships: [['r1', B]] },
            { stars: ['r3'], ships: [['r1', B]] }
        ])
        const [, , y2, b2, r3] = state.starMap.systems.map((s) => s.id)
        const ship = shipAt(state, y2 ?? -1, 'g1', A)
        expect(() => act(state, move(ship, b2 ?? -1))).toThrow()
        expect(() => act(state, discover(ship, PyramidColor.Red, PyramidSize.Medium))).toThrow()
        const moved = act(state, move(ship, r3 ?? -1))
        expect(system(moved, r3 ?? -1)?.ships).toHaveLength(2)
        // The Medium yellow star was left empty: back to the Bank.
        expect(system(moved, y2 ?? -1)).toBeUndefined()
        const found = act(state, discover(ship, PyramidColor.Blue, PyramidSize.Small))
        const discovered = found.starMap.systems.find((s) => s.ships.some((x) => x.piece === ship))
        expect(discovered?.stars.map((star) => `${pieceColor(star)}${pieceSize(star)}`)).toEqual([
            'blue1'
        ])
    })

    it('keeps an empty homeworld on the map', () => {
        const state = position([
            { home: A, stars: ['y1', 'r2'], ships: [['g3', A]] },
            HOMES[1] ?? { stars: [] },
            { stars: ['b3'], ships: [['g1', B]] }
        ])
        const b3 = state.starMap.systems[2]?.id ?? -1
        const moved = act(state, move(shipAt(state, HOME_A, 'g3', A), b3))
        expect(system(moved, HOME_A)?.ships).toEqual([])
        expect(system(moved, HOME_A)?.stars).toHaveLength(2)
    })

    it('captures a ship no larger than the largest of its own there', () => {
        const state = position([
            ...HOMES,
            {
                stars: ['g3'],
                ships: [
                    ['r1', A],
                    ['y2', A],
                    ['r2', B],
                    ['b3', B]
                ]
            }
        ])
        const g3 = state.starMap.systems[2]?.id ?? -1
        const medium = shipAt(state, g3, 'r2', B)
        const large = shipAt(state, g3, 'b3', B)
        expect(() => act(state, capture(large))).toThrow()
        const after = act(state, capture(medium))
        expect(system(after, g3)?.ships.find((ship) => ship.piece === medium)?.ownerId).toBe(A)
    })

    it('captures with the red of the star', () => {
        const state = position([
            ...HOMES,
            {
                stars: ['r3'],
                ships: [
                    ['y1', A],
                    ['b1', B]
                ]
            }
        ])
        const r3 = state.starMap.systems[2]?.id ?? -1
        const after = act(state, capture(shipAt(state, r3, 'b1', B)))
        expect(system(after, r3)?.ships.every((ship) => ship.ownerId === A)).toBe(true)
    })

    it('trades a ship for another colour of its size, only when the Bank has one', () => {
        const state = position([
            {
                home: A,
                stars: ['b1', 'r2'],
                ships: [
                    ['g3', A],
                    ['y3', A]
                ]
            },
            {
                home: B,
                stars: ['y3', 'b1'],
                ships: [
                    ['g3', B],
                    ['r3', B]
                ]
            }
        ])
        const ship = shipAt(state, HOME_A, 'g3', A)
        const after = act(state, trade(ship, PyramidColor.Blue))
        const traded = system(after, HOME_A)?.ships.find(
            (candidate) => pieceColor(candidate.piece) === PyramidColor.Blue
        )
        expect(traded && pieceSize(traded.piece)).toBe(PyramidSize.Large)
        // The same colour is no trade.
        expect(() => act(state, trade(ship, PyramidColor.Green))).toThrow()
        // All three Large yellows taken: no trade to Large yellow.
        const scarce = position([
            {
                home: A,
                stars: ['b1', 'r2'],
                ships: [
                    ['g3', A],
                    ['y3', A]
                ]
            },
            {
                home: B,
                stars: ['y3', 'b1'],
                ships: [
                    ['g3', B],
                    ['y3', B]
                ]
            }
        ])
        expect(() =>
            act(scarce, trade(shipAt(scarce, HOME_A, 'g3', A), PyramidColor.Yellow))
        ).toThrow()
    })

    it('rejects ship numbers that are no piece', () => {
        const state = position(HOMES)
        for (const ship of [0.5, -1, PIECE_COUNT, 1e9]) {
            expect(() => act(state, trade(ship, PyramidColor.Blue))).toThrow()
            expect(() => act(state, sacrifice(ship))).toThrow()
        }
        expect(() => act(state, build(HOME_A + 0.5, PyramidColor.Green))).toThrow()
    })
})

describe('Sacrifice', () => {
    it('gives as many actions of its colour as it has pips, anywhere the player has a ship', () => {
        let state = position([
            {
                home: A,
                stars: ['b1', 'r2'],
                ships: [
                    ['g3', A],
                    ['y3', A]
                ]
            },
            HOMES[1] ?? { stars: [] },
            { stars: ['g3'], ships: [['b1', A]] }
        ])
        const g3 = state.starMap.systems[2]?.id ?? -1
        state = act(state, sacrifice(shipAt(state, HOME_A, 'y3', A)))
        expect(state.machineState).toBe(MachineState.SacrificeActions)
        expect(state.sacrifice).toEqual({ color: PyramidColor.Yellow, remaining: 3 })
        // No yellow on the map, yet the ship at the Large green moves, then discovers.
        const ship = shipAt(state, g3, 'b1', A)
        state = act(state, move(ship, HOME_A))
        state = act(state, discover(ship, PyramidColor.Red, PyramidSize.Large))
        expect(state.sacrifice?.remaining).toBe(1)
        // Stop early: the last action is lost.
        state = act(state, endTurn())
        expect(state.activePlayerIds).toEqual([B])
        expect(state.sacrifice).toBeUndefined()
    })

    it('lets the sacrificed piece come straight back from the Bank', () => {
        let state = position([
            {
                home: A,
                stars: ['b3', 'r2'],
                ships: [
                    ['g3', A],
                    ['y1', A],
                    ['r1', A]
                ]
            },
            {
                home: B,
                stars: ['y3', 'b1'],
                ships: [
                    ['g3', B],
                    ['y1', B]
                ]
            },
            { stars: ['y1'], ships: [['g1', B]] }
        ])
        const given = shipAt(state, HOME_A, 'y1', A)
        state = act(state, sacrifice(given))
        state = act(
            state,
            discover(shipAt(state, HOME_A, 'g3', A), PyramidColor.Yellow, PyramidSize.Small)
        )
        expect(system(state, given)?.stars).toEqual([given])
    })

    it('ends the turn by itself once its actions are used', () => {
        let state = position([
            {
                home: A,
                stars: ['b1', 'r2'],
                ships: [
                    ['g3', A],
                    ['g1', A]
                ]
            },
            HOMES[1] ?? { stars: [] }
        ])
        state = act(state, sacrifice(shipAt(state, HOME_A, 'g1', A)))
        state = act(state, build(HOME_A, PyramidColor.Green))
        expect(state.activePlayerIds).toEqual([B])
    })
})

describe('Catastrophes', () => {
    const crowded = (): HomeworldsGameState =>
        position([
            ...HOMES,
            {
                stars: ['r3'],
                ships: [
                    ['r1', A],
                    ['r2', B],
                    ['r1', B],
                    ['y1', A],
                    ['g2', B]
                ]
            },
            {
                stars: ['y2'],
                ships: [
                    ['b2', A],
                    ['b3', B],
                    ['b1', B],
                    ['b2', B],
                    ['g1', B]
                ]
            }
        ])

    it('may be declared before the action, and the action follows', () => {
        let state = crowded()
        const y2 = state.starMap.systems[3]?.id ?? -1
        state = act(state, catastrophe(y2, PyramidColor.Blue))
        expect(state.machineState).toBe(MachineState.TakingTurn)
        const left = system(state, y2)
        expect(left?.ships.map((ship) => pieceColor(ship.piece))).toEqual([PyramidColor.Green])
    })

    it('destroys every ship when the star goes, and the star returns to the Bank', () => {
        let state = crowded()
        const r3 = state.starMap.systems[2]?.id ?? -1
        state = act(state, catastrophe(r3, PyramidColor.Red))
        expect(system(state, r3)).toBeUndefined()
    })

    it('leaves a homeworld a single star when half of it goes', () => {
        let state = position([
            { home: A, stars: ['b1', 'r2'], ships: [['g3', A]] },
            {
                home: B,
                stars: ['y3', 'b1'],
                ships: [
                    ['g3', B],
                    ['y2', A],
                    ['y1', A],
                    ['y1', A]
                ]
            }
        ])
        state = act(state, catastrophe(HOME_B, PyramidColor.Yellow))
        const home = system(state, HOME_B)
        expect(home?.stars.map(pieceColor)).toEqual([PyramidColor.Blue])
        expect(home?.homeworldOf).toBe(B)
        expect(home?.ships.map((ship) => ship.ownerId)).toEqual([B])
    })

    it("may come after the last of a sacrifice's actions", () => {
        let state = position([
            {
                home: A,
                stars: ['b1', 'r2'],
                ships: [
                    ['g3', A],
                    ['y2', A]
                ]
            },
            HOMES[1] ?? { stars: [] },
            {
                stars: ['g3'],
                ships: [
                    ['g1', A],
                    ['g1', B],
                    ['b1', A]
                ]
            }
        ])
        const g3 = state.starMap.systems[2]?.id ?? -1
        state = act(state, sacrifice(shipAt(state, HOME_A, 'y2', A)))
        state = act(state, move(shipAt(state, g3, 'b1', A), HOME_A))
        // Three greens: not overpopulated yet.
        expect(() => act(state, catastrophe(g3, PyramidColor.Green))).toThrow()
        state = act(state, move(shipAt(state, HOME_A, 'g3', A), g3))
        // The turn waits: four greens at the Large green star.
        expect(state.machineState).toBe(MachineState.FinishingTurn)
        state = act(state, catastrophe(g3, PyramidColor.Green))
        expect(system(state, g3)).toBeUndefined()
        expect(state.activePlayerIds).toEqual([B])
    })

    it('waits for the player whenever a catastrophe can be declared', () => {
        let state = crowded()
        state = act(state, build(HOME_A, PyramidColor.Green))
        expect(state.machineState).toBe(MachineState.FinishingTurn)
        state = act(state, endTurn())
        expect(state.activePlayerIds).toEqual([B])
    })
})

describe('End of the game', () => {
    it('never ends the turn by itself with the player out of their homeworld', () => {
        let state = position([
            { home: A, stars: ['y1', 'r2'], ships: [['g3', A]] },
            HOMES[1] ?? { stars: [] },
            { stars: ['b3'], ships: [['g1', B]] }
        ])
        const b3 = state.starMap.systems[2]?.id ?? -1
        state = act(state, move(shipAt(state, HOME_A, 'g3', A), b3))
        expect(state.machineState).toBe(MachineState.FinishingTurn)
        expect(state.activePlayerIds).toEqual([A])
        state = act(state, endTurn())
        expect(state.machineState).toBe(MachineState.EndOfGame)
        expect(state.winningPlayerIds).toEqual([B])
        expect(state.result).toBe(GameResult.Win)
        expect(HomeworldsRuntime.scoring?.finalScores(state)).toEqual({ [A]: 0, [B]: 1 })
    })

    it('wins by capturing the last ship at the enemy homeworld', () => {
        let state = position([
            { home: A, stars: ['b1', 'r2'], ships: [['g3', A]] },
            {
                home: B,
                stars: ['r3', 'b1'],
                ships: [
                    ['g2', B],
                    ['y3', A]
                ]
            }
        ])
        state = act(state, capture(shipAt(state, HOME_B, 'g2', B)))
        expect(state.machineState).toBe(MachineState.EndOfGame)
        expect(state.winningPlayerIds).toEqual([A])
        expect(state.endReason).toBe(EndReason.Eliminated)
    })

    it('keeps a player in the game at a homeworld left a single star', () => {
        let state = position([
            {
                home: A,
                stars: ['y2', 'b2'],
                ships: [
                    ['g3', A],
                    ['b1', A]
                ]
            },
            {
                home: B,
                stars: ['r3', 'b1'],
                ships: [
                    ['g2', B],
                    ['r1', A],
                    ['r2', A],
                    ['r1', B]
                ]
            }
        ])
        state = act(state, move(shipAt(state, HOME_A, 'g3', A), HOME_B))
        state = act(state, catastrophe(HOME_B, PyramidColor.Red))
        expect(system(state, HOME_B)?.stars.map(pieceColor)).toEqual([PyramidColor.Blue])
        expect(state.activePlayerIds).toEqual([B])
        expect(state.machineState).toBe(MachineState.TakingTurn)
    })

    it('draws when both are left with nothing at home', () => {
        let state = position([
            { home: A, stars: ['y2', 'b2'], ships: [['g3', A]] },
            {
                home: B,
                stars: ['r3', 'r1'],
                ships: [
                    ['g2', B],
                    ['r2', B],
                    ['r1', A]
                ]
            }
        ])
        state = act(state, move(shipAt(state, HOME_A, 'g3', A), HOME_B))
        state = act(state, catastrophe(HOME_B, PyramidColor.Red))
        expect(system(state, HOME_B)).toBeUndefined()
        state = act(state, endTurn())
        expect(state.machineState).toBe(MachineState.EndOfGame)
        expect(state.endReason).toBe(EndReason.BothEliminated)
        expect(state.result).toBe(GameResult.Draw)
        expect(HomeworldsRuntime.scoring?.finalScores(state)).toEqual({ [A]: 1, [B]: 1 })
    })

    it('draws when the same position comes round the third time', () => {
        let state = position([
            { home: A, stars: ['b1', 'y2'], ships: [['g3', A]] },
            { home: B, stars: ['y3', 'b1'], ships: [['g3', B]] }
        ])
        const hydrated = hydrate(state)
        state.positions = [hydrated.positionHash(A)]
        for (let round = 0; round < 2; round += 1) {
            state = act(state, endTurn(A))
            if (state.machineState === MachineState.EndOfGame) break
            state = act(state, endTurn(B))
        }
        expect(state.machineState).toBe(MachineState.EndOfGame)
        expect(state.endReason).toBe(EndReason.Repetition)
        expect(state.result).toBe(GameResult.Draw)
    })

    it('records a pass', () => {
        const game = gameFor()
        const state = start(game)
        const result = engine.executeCanonicalAction({ game, state, action: endTurn() })
        const recorded = result.processedActions[0]
        assert(isEndTurn(recorded), 'The pass is recorded')
        expect(recorded.metadata).toEqual({ passed: true, unused: 0 })
        expect(result.updatedState.activePlayerIds).toEqual([B])
    })
})

describe('Configuration', () => {
    it('reads the setup, defaulting a missing one and rejecting an unknown one', () => {
        expect(setupFromConfig({})).toBe(Setup.Chosen)
        expect(setupFromConfig({ setup: Setup.FirstGame })).toBe(Setup.FirstGame)
        expect(() => setupFromConfig({ setup: 'Other' })).toThrow()
    })

    it('reads the first player, defaulting a missing one and rejecting an unknown one', () => {
        expect(firstPlayerFromConfig({})).toBe(FirstPlayer.Random)
        expect(firstPlayerFromConfig({ firstPlayer: FirstPlayer.Opponent })).toBe(
            FirstPlayer.Opponent
        )
        expect(() => firstPlayerFromConfig({ firstPlayer: 'Other' })).toThrow()
    })

    it('draws the first player at random over seeds', () => {
        const firsts = new Set<string>()
        for (let seed = 1; seed <= 8; seed += 1) {
            const game = { ...createGame(), seed }
            const state = engine.startGame(game).initialState
            firsts.add(state.activePlayerIds[0] ?? '')
        }
        expect(firsts).toEqual(new Set([A, B]))
    })

    it('lets the creator or the opponent go first', () => {
        const owner = { ownerId: 'u1', userIds: { [A]: 'u2', [B]: 'u1' } }
        for (const [choice, first] of [
            [FirstPlayer.Creator, B],
            [FirstPlayer.Opponent, A]
        ] as const) {
            const game = createTestGame({ firstPlayer: choice }, [A, B], owner)
            expect(engine.startGame(game).initialState.activePlayerIds).toEqual([first])
        }
    })
})

describe('Playouts', () => {
    for (const setup of [Setup.Chosen, Setup.FirstGame]) {
        it(`end with a result (${setup})`, () => {
            for (let seed = 1; seed <= 12; seed += 1) {
                const game = { ...createGame({ setup }), seed }
                const initial = engine.startGame(game, { masterSeed: MASTER_SEED }).initialState
                const finished = playToEnd(game, initial, seed)
                expect(finished.machineState).toBe(MachineState.EndOfGame)
                expect(finished.winningPlayerIds.length).toBeGreaterThan(0)
                expect(finished.turnManager.series.length).toBeLessThanOrEqual(3)
                expect(HomeworldsGameStateValidator.Check(finished)).toBe(true)
                expect(legalActions(game, finished)).toEqual([])
            }
        }, 120_000)
    }

    it('plays the same game from the same seed', () => {
        const run = () => {
            const game = { ...createGame(), seed: 3 }
            const initial = engine.startGame(game, { masterSeed: MASTER_SEED }).initialState
            return playToEnd(game, initial, 3)
        }
        expect(run().starMap).toEqual(run().starMap)
    })
})
