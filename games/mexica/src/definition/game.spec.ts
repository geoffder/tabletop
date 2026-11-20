import { describe, expect, it } from 'vitest'
import { assert, GameResult } from '@tabletop/common'
import {
    actionBase,
    chooseStarts,
    createGame,
    execute,
    hydrate,
    type MexicaGame,
    playToEnd,
    run,
    startGame
} from './tests/playthrough.js'
import { MachineState } from './states.js'
import { ActionType } from './actions.js'
import { MexicaGameStateValidator, type MexicaGameState } from '../model/gameState.js'
import {
    Axis,
    cellAt,
    type Cell,
    isLand,
    LAND_CELLS,
    PALACE_CENTRE,
    START_CELLS,
    touchesLake,
    manhattan
} from '../model/board.js'
import { rankAwards } from '../model/scoring.js'
import { isBuildTemple } from '../actions/buildTemple.js'
import { isFoundDistrict } from '../actions/foundDistrict.js'
import { DISTRICT_SIZES, placePoints, tokenSize } from '../model/pieces.js'

// Cells by name: "C5" is column C, row 5.
function c(name: string): Cell {
    const cell = cellAt(name.charCodeAt(0) - 65, Number(name.slice(1)) - 1)
    assert(cell !== undefined, `No cell ${name}`)
    return cell
}

function started(players = ['red', 'blue', 'green', 'yellow'], config = {}) {
    const game = createGame(players, { config })
    return { game, state: chooseStarts(game, startGame(game)) }
}

function act(game: MexicaGame, state: MexicaGameState, type: ActionType, fields = {}) {
    const action = { ...actionBase(game, state.activePlayerIds[0]), type, ...fields }
    return run(game, state, action)
}

function rejects(game: MexicaGame, state: MexicaGameState, type: ActionType, fields = {}) {
    expect(() =>
        execute(game, state, { ...actionBase(game, state.activePlayerIds[0]), type, ...fields })
    ).toThrow()
}

// Rewrites the position: canals as lists of cells, Pilli Mexica by player.
function position(
    state: MexicaGameState,
    setup: {
        canals?: Cell[][]
        bridges?: { cell: Cell; axis: Axis }[]
        temples?: { cell: Cell; level: 1 | 2 | 3 | 4; playerId?: string }[]
        pillis?: Record<string, Cell>
        districts?: { tokenId: number; cell: Cell }[]
        display?: number[]
        apLeft?: number
    }
): MexicaGameState {
    const next = structuredClone(state)
    if (setup.canals) next.canals = [...next.canals, ...setup.canals.map((cells) => ({ cells }))]
    if (setup.bridges) next.bridges = setup.bridges
    if (setup.temples) next.temples = setup.temples
    if (setup.districts) next.districts = setup.districts
    if (setup.display) next.display = setup.display
    if (setup.apLeft !== undefined) next.apLeft = setup.apLeft
    for (const [playerId, cell] of Object.entries(setup.pillis ?? {})) {
        const player = next.players.find((p) => p.playerId === playerId)
        assert(player !== undefined, 'player')
        player.pilli = cell
    }
    return next
}

// Ends turns until it is the player's turn again.
function passRound(game: MexicaGame, state: MexicaGameState, upTo?: string): MexicaGameState {
    do {
        state = act(game, state, ActionType.EndTurn)
    } while (
        state.machineState === MachineState.Acting &&
        upTo !== undefined &&
        state.activePlayerIds[0] !== upTo
    )
    return state
}

describe('Mexica', () => {
    describe('setup', () => {
        it('starts with eight tokens on display, seven set aside, and the dug canal', () => {
            const game = createGame()
            const state = startGame(game)
            expect(state.display).toHaveLength(8)
            expect(state.reserve).toHaveLength(7)
            expect([...state.display, ...state.reserve].sort((a, b) => a - b)).toEqual(
                DISTRICT_SIZES.map((_, id) => id)
            )
            expect(state.display.map(tokenSize)).toEqual(
                [...state.display.map(tokenSize)].sort((a, b) => a - b)
            )
            expect(state.canals.map((canal) => canal.cells)).toEqual([
                [c('O6'), c('O7')],
                [c('O8'), c('O9')]
            ])
            expect(LAND_CELLS).toHaveLength(196)
            expect(state.machineState).toBe(MachineState.ChoosingStart)
            assert(MexicaGameStateValidator.Check(state), 'valid state')
        })

        it('has each player pick a free starting space in turn order', () => {
            const game = createGame()
            let state = startGame(game)
            const first = state.activePlayerIds[0]
            state = act(game, state, ActionType.ChooseStart, { cell: c('H6') })
            expect(state.players.find((p) => p.playerId === first)?.pilli).toBe(c('H6'))
            rejects(game, state, ActionType.ChooseStart, { cell: c('H6') })
            rejects(game, state, ActionType.ChooseStart, { cell: PALACE_CENTRE })
            state = chooseStarts(game, state)
            expect(state.machineState).toBe(MachineState.Acting)
            expect(state.activePlayerIds[0]).toBe(state.turnManager.turnOrder[0])
            expect(new Set(state.players.map((p) => p.pilli))).toEqual(new Set(START_CELLS))
        })

        it('places twenty levels of neutral temples apart from each other for two players', () => {
            for (let seed = 1; seed <= 6; seed++) {
                const game = createGame(['red', 'blue'], { seed })
                const state = startGame(game)
                expect(state.temples).toHaveLength(10)
                expect(state.temples.reduce((sum, t) => sum + t.level, 0)).toBe(20)
                for (const temple of state.temples) {
                    expect(temple.playerId).toBeUndefined()
                    expect(touchesLake(temple.cell)).toBe(false)
                    for (const other of state.temples) {
                        if (other !== temple)
                            expect(manhattan(temple.cell, other.cell)).toBeGreaterThanOrEqual(5)
                    }
                }
            }
        })

        it('leaves the neutral temples out when the option is off, or with more players', () => {
            const off = createGame(['red', 'blue'], { config: { neutralTemples: false } })
            expect(startGame(off).temples).toHaveLength(0)
            expect(startGame(createGame(['red', 'blue', 'green'])).temples).toHaveLength(0)
        })
    })

    describe('action points', () => {
        it('spends the turn’s own points before action tokens', () => {
            const { game, state: start } = started()
            const me = start.activePlayerIds[0]
            let state = position(start, { apLeft: 2 })
            state.players.find((p) => p.playerId === me)!.actionTokens = 3
            const temple = {
                ...actionBase(game, me),
                type: ActionType.BuildTemple,
                cell: c('E7'),
                level: 4
            }
            const result = execute(game, state, temple)
            state = result.updatedState
            expect(state.apLeft).toBe(0)
            expect(state.players.find((p) => p.playerId === me)?.actionTokens).toBe(1)
            const processed = result.processedActions[0]
            assert(isBuildTemple(processed), 'a temple')
            expect(processed.metadata).toEqual({ tokensSpent: 2 })
        })

        it('buys at most two tokens a turn, with the turn’s own points', () => {
            const { game, state: start } = started()
            let state = act(game, start, ActionType.TakeToken)
            state = act(game, state, ActionType.TakeToken)
            expect(state.apLeft).toBe(4)
            rejects(game, state, ActionType.TakeToken)
            const broke = position(start, { apLeft: 0 })
            broke.players.find((p) => p.playerId === start.activePlayerIds[0])!.actionTokens = 2
            rejects(game, broke, ActionType.TakeToken)
        })
    })

    describe('canals', () => {
        it('digs a single or a side-by-side double for one point', () => {
            const { game, state: start } = started()
            let state = act(game, start, ActionType.DigCanal, { cells: [c('C3')] })
            state = act(game, state, ActionType.DigCanal, { cells: [c('D3'), c('D4')] })
            expect(state.apLeft).toBe(4)
            rejects(game, state, ActionType.DigCanal, { cells: [c('E3'), c('F4')] })
        })

        it('never digs on the palace, the lake, a canal, a piece or a bridge’s ramp', () => {
            const { game, state: start } = started()
            const state = position(start, {
                canals: [[c('C5')]],
                bridges: [{ cell: c('C5'), axis: Axis.NorthSouth }],
                temples: [{ cell: c('F5'), level: 1, playerId: 'red' }]
            })
            for (const cell of [
                PALACE_CENTRE,
                c('H6'),
                c('A1'),
                c('O6'),
                c('F5'),
                c('C4'),
                c('C6')
            ])
                rejects(game, state, ActionType.DigCanal, { cells: [cell] })
            expect(() => act(game, state, ActionType.DigCanal, { cells: [c('B5')] })).not.toThrow()
        })

        it('never digs into a founded district', () => {
            const { game, state: start } = started()
            // The spur B1–B2 is cut off and founded.
            const state = position(start, {
                canals: [[c('B3'), c('C3')], [c('A3')], [c('C2')]],
                districts: [{ tokenId: 0, cell: c('B1') }]
            })
            rejects(game, state, ActionType.DigCanal, { cells: [c('B2')] })
        })
    })

    describe('districts and founding', () => {
        // B1, B2 and C2, cut off by canals at D2, B3 and C3 and the lake.
        function threeDistrict(start: MexicaGameState) {
            return position(start, { canals: [[c('D2')], [c('B3'), c('C3')]] })
        }

        it('counts the palace spaces in a district’s size', () => {
            const { state: start } = started()
            const ring = [
                ['F5', 'G5'],
                ['H5', 'I5'],
                ['J5', 'J6'],
                ['J7', 'J8'],
                ['J9', 'I9'],
                ['H9', 'G9'],
                ['F9', 'F8'],
                ['F7', 'F6']
            ].map((pair) => pair.map(c))
            const state = hydrate(position(start, { canals: ring }))
            const district = state.layout().districtOf(PALACE_CENTRE)
            expect(district).toHaveLength(9)
        })

        it('founds a district of a size on display, scoring the founder and visitors', () => {
            const { game, state: start } = started()
            const [me, other] = start.turnManager.turnOrder
            const three = DISTRICT_SIZES.indexOf(3)
            let state = threeDistrict(start)
            state = position(state, {
                pillis: { [me]: c('B2'), [other]: c('C2') },
                display: [three, ...state.display.filter((id) => id !== three)]
            })
            const founding = {
                ...actionBase(game, me),
                type: ActionType.FoundDistrict,
                cell: c('B1')
            }
            const result = execute(game, state, founding)
            state = result.updatedState
            const [, second, third] = placePoints(3)
            expect(state.players.find((p) => p.playerId === me)?.score).toBe(second)
            expect(state.players.find((p) => p.playerId === other)?.score).toBe(third)
            expect(state.apLeft).toBe(6)
            expect(state.districts).toEqual([{ tokenId: three, cell: c('B1') }])
            expect(state.display).not.toContain(three)
            const processed = result.processedActions[0]
            assert(isFoundDistrict(processed), 'a founding')
            expect(processed.metadata).toEqual({
                tokenId: three,
                points: second,
                visitors: [{ playerId: other, points: third }]
            })
        })

        it('needs the founder in the district, a matching token and a free non-palace space', () => {
            const { game, state: start } = started()
            const me = start.activePlayerIds[0]
            const three = DISTRICT_SIZES.indexOf(3)
            const state = position(threeDistrict(start), {
                display: start.display.filter((id) => tokenSize(id) !== 3)
            })
            rejects(
                game,
                position(state, { pillis: { [me]: c('B2') } }),
                ActionType.FoundDistrict,
                {
                    cell: c('B1')
                }
            )
            const shown = position(state, { display: [three] })
            rejects(game, shown, ActionType.FoundDistrict, { cell: c('B1') })
            rejects(
                game,
                position(shown, { pillis: { [me]: c('B2') } }),
                ActionType.FoundDistrict,
                { cell: c('B2') }
            )
        })
    })

    describe('temples', () => {
        it('go in the Pilli Mexica’s district, off the palace, for their levels', () => {
            const { game, state: start } = started()
            let state = act(game, start, ActionType.BuildTemple, { cell: c('E7'), level: 3 })
            expect(state.apLeft).toBe(3)
            rejects(game, state, ActionType.BuildTemple, { cell: PALACE_CENTRE, level: 1 })
            rejects(game, state, ActionType.BuildTemple, { cell: c('E7'), level: 1 })
            rejects(game, state, ActionType.BuildTemple, { cell: c('E8'), level: 4 })
            state = act(game, state, ActionType.BuildTemple, { cell: c('E8'), level: 3 })
            rejects(game, position(state, { apLeft: 6 }), ActionType.BuildTemple, {
                cell: c('E9'),
                level: 3
            })
        })

        it('allows nine temples in the first period and all eighteen in the second', () => {
            const { state: start } = started()
            const me = start.activePlayerIds[0]
            const state = hydrate(start)
            expect([1, 2, 3, 4].map((level) => state.templesLeft(me, level as 1))).toEqual([
                3, 3, 2, 1
            ])
            state.period = 2
            expect([1, 2, 3, 4].map((level) => state.templesLeft(me, level as 1))).toEqual([
                6, 5, 4, 3
            ])
        })
    })

    describe('movement', () => {
        it('walks for one point a step and teleports anywhere free for five', () => {
            const { state: start } = started()
            const me = start.activePlayerIds[0]
            const state = hydrate(position(start, { pillis: { [me]: c('E5') } }))
            expect(state.moves(me).get(c('E7'))).toMatchObject({ cost: 2, teleport: false })
            expect(state.moves(me).get(c('T7'))).toMatchObject({ cost: 5, teleport: true })
        })

        it('boards a bridge only from its ends', () => {
            const { state: start } = started()
            const me = start.activePlayerIds[0]
            const state = hydrate(
                position(start, {
                    canals: [[c('E5')]],
                    bridges: [{ cell: c('E5'), axis: Axis.NorthSouth }],
                    pillis: { [me]: c('D5') }
                })
            )
            expect(state.moves(me).get(c('E5'))?.cost).toBe(3)
            const fromEnd = hydrate(position(state.dehydrate(), { pillis: { [me]: c('E4') } }))
            expect(fromEnd.moves(me).get(c('E5'))?.cost).toBe(1)
            expect(fromEnd.moves(me).get(c('E6'))?.cost).toBe(2)
        })

        it('sails a bridge to the next for one point, and one more for each bridge passed under', () => {
            const { state: start } = started()
            const [me, other] = start.turnManager.turnOrder
            // A canal along row 4 from C to H, bridged at C, E and G.
            const state = hydrate(
                position(start, {
                    canals: [
                        [c('C4'), c('D4')],
                        [c('E4'), c('F4')],
                        [c('G4'), c('H4')]
                    ],
                    bridges: [
                        { cell: c('C4'), axis: Axis.NorthSouth },
                        { cell: c('E4'), axis: Axis.NorthSouth },
                        { cell: c('G4'), axis: Axis.NorthSouth }
                    ],
                    pillis: { [me]: c('C4'), [other]: c('E4') }
                })
            )
            const moves = state.moves(me)
            expect(moves.has(c('E4'))).toBe(false)
            expect(moves.get(c('G4'))).toMatchObject({ cost: 2, path: [c('C4'), c('E4'), c('G4')] })
        })

        it('crosses the lake for one point between bridges on canals that reach it', () => {
            const { state: start } = started()
            const me = start.activePlayerIds[0]
            // C2 meets the lake above it, A12 the lake on its left.
            const state = hydrate(
                position(start, {
                    canals: [[c('C2')], [c('A12')]],
                    bridges: [
                        { cell: c('C2'), axis: Axis.EastWest },
                        { cell: c('A12'), axis: Axis.NorthSouth }
                    ],
                    pillis: { [me]: c('C2') }
                })
            )
            expect(state.moves(me).get(c('A12'))).toMatchObject({ cost: 1, teleport: false })
        })
    })

    describe('bridges', () => {
        it('span a canal with ground at both ends', () => {
            const { game, state: start } = started()
            const state = position(start, { canals: [[c('E5')], [c('E6')]] })
            expect(() =>
                act(game, state, ActionType.BuildBridge, { cell: c('E5'), axis: Axis.EastWest })
            ).not.toThrow()
            rejects(game, state, ActionType.BuildBridge, { cell: c('E5'), axis: Axis.NorthSouth })
            rejects(game, state, ActionType.BuildBridge, { cell: c('E4'), axis: Axis.EastWest })
        })

        it('move only once all eleven are built, and never with a Pilli Mexica on them', () => {
            const { game, state: start } = started()
            const me = start.activePlayerIds[0]
            const cells = ['C4', 'C6', 'C8', 'C10', 'E4', 'E6', 'E8', 'E10', 'K4', 'K10', 'M10']
            const canals = cells.map((name) => [c(name)])
            const some = position(start, {
                canals: [...canals, [c('L4')]],
                bridges: cells.slice(0, 10).map((name) => ({ cell: c(name), axis: Axis.EastWest }))
            })
            rejects(game, some, ActionType.MoveBridge, {
                bridgeId: 0,
                cell: c('L4'),
                axis: Axis.NorthSouth
            })
            const all = position(some, {
                bridges: cells.map((name) => ({ cell: c(name), axis: Axis.EastWest }))
            })
            const moved = act(game, all, ActionType.MoveBridge, {
                bridgeId: 0,
                cell: c('L4'),
                axis: Axis.NorthSouth
            })
            expect(moved.bridges[0]).toEqual({ cell: c('L4'), axis: Axis.NorthSouth })
            const occupied = position(all, { pillis: { [me]: c('C4') } })
            rejects(game, occupied, ActionType.MoveBridge, {
                bridgeId: 0,
                cell: c('L4'),
                axis: Axis.NorthSouth
            })
        })
    })

    describe('the first round', () => {
        it('forbids leaving another Pilli Mexica without a step, and allows it later', () => {
            const { game, state: start } = started()
            const [me, other] = start.turnManager.turnOrder
            const setup = {
                canals: [[c('C2')], [c('D3')]],
                pillis: { [other]: c('C3'), [me]: c('E5') }
            }
            // C3's neighbours: C2 canal, D3 canal, B3 and C4 left free; build on them.
            let state = position(start, {
                ...setup,
                temples: [{ cell: c('B3'), level: 1, playerId: other }]
            })
            const shut = { cells: [c('C4')] }
            rejects(game, state, ActionType.DigCanal, shut)
            state = passRound(game, state, me)
            expect(() => act(game, state, ActionType.DigCanal, shut)).not.toThrow()
        })
        it('forbids walling another Pilli Mexica off from the rest of the island', () => {
            const { game, state: start } = started()
            const [me] = start.turnManager.turnOrder
            const ring = [
                ['F5', 'G5'],
                ['H5', 'I5'],
                ['J5', 'J6'],
                ['J7', 'J8'],
                ['J9', 'I9'],
                ['H9', 'G9'],
                ['F9', 'F8']
            ].map((pair) => pair.map(c))
            let state = position(start, { canals: ring, pillis: { [me]: c('D3') } })
            const close = { cells: [c('F7'), c('F6')] }
            rejects(game, state, ActionType.DigCanal, close)
            state = passRound(game, state, me)
            expect(() => act(game, state, ActionType.DigCanal, close)).not.toThrow()
        })
    })

    describe('scoring', () => {
        it('ranks by levels, ties sharing a place in full and skipping the next', () => {
            const points = placePoints(10)
            expect(
                rankAwards(
                    new Map([
                        ['a', 5],
                        ['b', 5],
                        ['c', 2],
                        ['d', 0]
                    ]),
                    points
                )
            ).toEqual([
                { playerId: 'a', place: 1, levels: 5, points: 10 },
                { playerId: 'b', place: 1, levels: 5, points: 10 },
                { playerId: 'c', place: 3, levels: 2, points: 3 }
            ])
            expect(
                rankAwards(
                    new Map([
                        ['a', 5],
                        ['b', 3],
                        ['c', 3]
                    ]),
                    points
                )
            ).toEqual([
                { playerId: 'a', place: 1, levels: 5, points: 10 },
                { playerId: 'b', place: 2, levels: 3, points: 5 },
                { playerId: 'c', place: 2, levels: 3, points: 5 }
            ])
            expect(
                rankAwards(
                    new Map([
                        ['neutral', 9],
                        ['a', 1]
                    ]),
                    points
                )
            ).toEqual([{ playerId: 'a', place: 2, levels: 1, points: 5 }])
        })

        it('gives a token’s values in thirds rounded up', () => {
            expect(placePoints(13)).toEqual([13, 7, 4])
            expect(placePoints(10)).toEqual([10, 5, 3])
            expect(placePoints(7)).toEqual([7, 4, 2])
            expect(placePoints(3)).toEqual([3, 2, 1])
        })
    })

    describe('period ends', () => {
        it('end after the round once every token is used and someone has built all temples', () => {
            const { game, state: start } = started()
            const [first, second] = start.turnManager.turnOrder
            const temples = [
                ...[1, 1, 1, 2, 2, 2, 3, 3, 4].map((level, i) => ({
                    cell: c(`${String.fromCharCode(66 + i)}11`),
                    level: level as 1 | 2 | 3 | 4,
                    playerId: second
                }))
            ]
            let state = position(start, { display: [], temples })
            state = act(game, state, ActionType.EndTurn)
            expect(state.machineState).toBe(MachineState.Acting)
            state = passRound(game, state, first)
            expect(state.period).toBe(2)
            expect(state.display).toHaveLength(7)
            expect(state.activePlayerIds[0]).toBe(first)
        })

        it('end at once after a full round in which nobody did anything', () => {
            const { game, state: start } = started()
            let state = act(game, start, ActionType.TakeToken)
            state = act(game, state, ActionType.EndTurn)
            for (let i = 0; i < 3; i++) state = act(game, state, ActionType.EndTurn)
            expect(state.period).toBe(1)
            state = act(game, state, ActionType.EndTurn)
            expect(state.period).toBe(2)
        })

        it('removes tokens no district can take any more', () => {
            const { game, state: start } = started()
            const thirteen = DISTRICT_SIZES.indexOf(13)
            const three = DISTRICT_SIZES.indexOf(3)
            // Flood every land cell but a few: no district of 13 can be made.
            const flooded = LAND_CELLS.filter(
                (cell) => isLand(cell) && !START_CELLS.includes(cell) && cell !== PALACE_CENTRE
            ).filter((cell) => !start.canals.some((canal) => canal.cells.includes(cell)))
            const state = position(start, {
                canals: flooded.slice(0, 41).map((cell) => [cell]),
                display: [three, thirteen]
            })
            const next = act(game, state, ActionType.TakeToken)
            expect(next.display).not.toContain(thirteen)
        })
    })

    describe('playouts', () => {
        for (const players of [
            ['red', 'blue'],
            ['red', 'blue', 'green'],
            ['red', 'blue', 'green', 'yellow']
        ]) {
            for (let seed = 1; seed <= 4; seed++) {
                it(`${players.length} players, seed ${seed}, end with a result`, () => {
                    const game = createGame(players, { seed })
                    const state = playToEnd(game, startGame(game), seed)
                    expect(state.machineState).toBe(MachineState.EndOfGame)
                    expect(state.result).toBeDefined()
                    expect(state.winningPlayerIds.length).toBeGreaterThan(0)
                    if (state.result === GameResult.Win)
                        expect(state.winningPlayerIds).toHaveLength(1)
                    expect(state.turnManager.series.length).toBeLessThanOrEqual(players.length + 1)
                    assert(MexicaGameStateValidator.Check(state), 'valid finished state')
                })
            }
        }
    })
})
