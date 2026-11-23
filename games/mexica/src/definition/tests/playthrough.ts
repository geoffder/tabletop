import {
    ActionSource,
    defaultGameConfig,
    GameEngine,
    PlayerStatus,
    type GameAction,
    type GameConfig,
    type StartingPositionAssignment
} from '@tabletop/common'
import { Definition } from '../definition.js'
import { MexicaRuntime } from '../runtime.js'
import { MexicaInfo } from '../info.js'
import { MachineState } from '../states.js'
import { ActionType } from '../actions.js'
import { HydratedMexicaGameState, type MexicaGameState } from '../../model/gameState.js'
import { Axis, LAND_CELLS, neighbour, Direction, START_CELLS } from '../../model/board.js'
import { LEVELS, tokenSize } from '../../model/pieces.js'

export const MASTER_SEED = '0123456789abcdef0123456789abcdef'

export const engine = new GameEngine(MexicaRuntime)

export function createGame(
    playerIds: string[] = ['red', 'blue', 'green', 'yellow'],
    options: { config?: GameConfig; seed?: number; ownerId?: string } = {}
) {
    return MexicaRuntime.initializer.initializeGame(
        {
            id: 'mexica-test',
            typeId: 'mexica',
            ownerId: options.ownerId ?? 'owner',
            seed: options.seed ?? 5,
            config: {
                ...defaultGameConfig(MexicaInfo.configurator?.options ?? []),
                ...options.config
            },
            players: playerIds.map((id) => ({
                id,
                name: id,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
}

export type MexicaGame = ReturnType<typeof createGame>

// The game's own seed picks the master seed, so seeded tests deal differently.
export function startGame(game: MexicaGame, assignment?: StartingPositionAssignment) {
    const masterSeed =
        game.seed === undefined ? MASTER_SEED : game.seed.toString(16).padStart(32, '0')
    return engine.startGame(game, {
        masterSeed,
        ...(assignment === undefined ? {} : { startingPositions: assignment })
    }).initialState
}

let counter = 0
export function actionBase(game: MexicaGame, playerId: string) {
    counter += 1
    return { id: `a${counter}`, gameId: game.id, source: ActionSource.User, playerId }
}

export function execute(game: MexicaGame, state: MexicaGameState, action: GameAction) {
    return engine.executeCanonicalAction({ game, state, action })
}

export function run(game: MexicaGame, state: MexicaGameState, action: GameAction) {
    return execute(game, state, action).updatedState
}

export function hydrate(state: MexicaGameState): HydratedMexicaGameState {
    return new HydratedMexicaGameState(structuredClone(state))
}

// Puts each Pilli Mexica on the next free starting space, in turn order.
export function chooseStarts(game: MexicaGame, state: MexicaGameState): MexicaGameState {
    while (state.machineState === MachineState.ChoosingStart) {
        const playerId = state.activePlayerIds[0]
        const cell = START_CELLS.find((start) => state.players.every((p) => p.pilli !== start))
        const choose = { ...actionBase(game, playerId), type: ActionType.ChooseStart, cell }
        state = run(game, state, choose)
    }
    return state
}

type Choice = { weight: number; actions: () => GameAction[] }

// A seeded player that keeps the game moving: it founds whatever it can, builds temples, digs
// canals and wanders, so both periods end within a few hundred turns.
export function playToEnd(
    game: MexicaGame,
    state: MexicaGameState,
    seed: number,
    stepCap = 6000
): MexicaGameState {
    let value = seed + 1
    const random = () => {
        value = (value * 1103515245 + 12345) % 2147483648
        return value / 2147483648
    }
    const pick = <T>(options: readonly T[]): T => options[Math.floor(random() * options.length)]
    let steps = 0
    while (state.machineState !== MachineState.EndOfGame) {
        if (steps++ > stepCap) throw Error(`No end after ${stepCap} steps`)
        if (state.machineState === MachineState.ChoosingStart) {
            state = chooseStarts(game, state)
            continue
        }
        const choices = actingChoices(game, state, pick)
        let done = false
        for (let tries = 0; tries < 20 && !done; tries++) {
            const total = choices.reduce((sum, choice) => sum + choice.weight, 0)
            let roll = random() * total
            const choice = choices.find((c) => (roll -= c.weight) < 0) ?? choices[0]
            const actions = choice.actions()
            if (actions.length === 0) continue
            try {
                state = run(game, state, pick(actions))
                done = true
            } catch {
                // A first-round action that would shut someone in; try another.
            }
        }
        if (!done) state = run(game, state, endTurn(game, state))
    }
    return state
}

function endTurn(game: MexicaGame, state: MexicaGameState): GameAction {
    return { ...actionBase(game, state.activePlayerIds[0]), type: ActionType.EndTurn }
}

function actingChoices(
    game: MexicaGame,
    data: MexicaGameState,
    pick: <T>(options: readonly T[]) => T
): Choice[] {
    const state = hydrate(data)
    const playerId = data.activePlayerIds[0]
    const base = () => actionBase(game, playerId)
    const ap = state.apAvailable(playerId)
    const layout = state.layout()
    const pilli = state.pilliOf(playerId)
    const sample = <T>(items: T[], count: number) =>
        Array.from({ length: Math.min(count, items.length) }, () => pick(items))

    const founding = (): GameAction[] => {
        const district = state.pilliDistrict(playerId, layout)
        if (district === undefined || state.foundingToken(playerId, layout) === undefined) return []
        return district
            .filter((cell) => layout.isBuildable(cell))
            .map((cell) => ({ ...base(), type: ActionType.FoundDistrict, cell }))
    }
    const found = founding()
    if (found.length > 0) return [{ weight: 1, actions: () => found }]

    const choices: Choice[] = [{ weight: ap === 0 ? 50 : 1, actions: () => [endTurn(game, data)] }]
    if (ap === 0) return choices

    // Head for a district whose size is on display.
    const wanted = new Set(state.display.map(tokenSize))
    const targets = layout
        .districts()
        .filter((district) => wanted.has(district.length) && layout.tokenIn(district) === undefined)
        .flatMap((district) => district.filter((cell) => layout.isEmptyGround(cell)))
    const moves = state.moves(playerId, layout)
    choices.push({
        weight: targets.length > 0 ? 6 : 1,
        actions: () => {
            const near = targets.filter((cell) => (moves.get(cell)?.cost ?? 99) <= ap)
            const any = [...moves.entries()].filter(([, move]) => move.cost <= ap)
            const options = near.length > 0 ? near : sample(any, 6).map(([cell]) => cell)
            return options.map((to) => ({ ...base(), type: ActionType.MovePilli, to }))
        }
    })
    choices.push({
        weight: 5,
        actions: () => {
            const district = state.pilliDistrict(playerId, layout) ?? []
            const levels = LEVELS.filter(
                (level) => level <= ap && state.templesLeft(playerId, level) > 0
            )
            const cells = district.filter((cell) => layout.isBuildable(cell))
            if (levels.length === 0 || cells.length === 0) return []
            return sample(cells, 4).map((cell) => ({
                ...base(),
                type: ActionType.BuildTemple,
                cell,
                level: pick(levels)
            }))
        }
    })
    choices.push({
        weight: 4,
        actions: () => {
            const cells = LAND_CELLS.filter((cell) => state.canDigAt(cell, layout))
            return sample(cells, 6).flatMap((cell) => {
                const other = neighbour(cell, pick([Direction.East, Direction.South]))
                const pair =
                    other !== undefined && state.canDigAt(other, layout) ? [cell, other] : []
                const options = [
                    ...(state.doubleCanalsLeft() > 0 && pair.length === 2 ? [pair] : []),
                    ...(state.singleCanalsLeft() > 0 ? [[cell]] : [])
                ]
                return options.map((cells) => ({ ...base(), type: ActionType.DigCanal, cells }))
            })
        }
    })
    choices.push({
        weight: 1,
        actions: () =>
            [...layout.canals].flatMap((cell) =>
                [Axis.NorthSouth, Axis.EastWest]
                    .filter((axis) => layout.bridgeFits(cell, axis))
                    .map((axis) =>
                        state.bridgesLeft() > 0
                            ? { ...base(), type: ActionType.BuildBridge, cell, axis }
                            : {
                                  ...base(),
                                  type: ActionType.MoveBridge,
                                  bridgeCell:
                                      state.bridges.find((b) => b.cell !== pilli)?.cell ?? -1,
                                  cell,
                                  axis
                              }
                    )
            )
    })
    if (state.canTakeToken()) {
        choices.push({
            weight: 0.5,
            actions: () => [{ ...base(), type: ActionType.TakeToken }]
        })
    }
    return choices
}
