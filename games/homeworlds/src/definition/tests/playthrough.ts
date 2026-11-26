import {
    ActionSource,
    defaultGameConfig,
    GameEngine,
    PlayerStatus,
    type GameAction
} from '@tabletop/common'
import { Definition } from '../definition.js'
import { HomeworldsRuntime } from '../runtime.js'
import { HomeworldsInfo } from '../info.js'
import type { FirstPlayer, Setup } from '../config.js'
import { MachineState } from '../states.js'
import { ActionType } from '../actions.js'
import { HydratedHomeworldsGameState, type HomeworldsGameState } from '../../model/gameState.js'
import { type PieceKind, PYRAMID_COLORS, PYRAMID_SIZES } from '../../model/pieces.js'
import { Power, type PowerUse } from '../../model/powers.js'
import type { Build } from '../../actions/build.js'
import type { Move } from '../../actions/move.js'
import type { Discover } from '../../actions/discover.js'
import type { Capture } from '../../actions/capture.js'
import type { Trade } from '../../actions/trade.js'
import type { CreateHomeworld } from '../../actions/createHomeworld.js'
import type { Catastrophe } from '../../actions/catastrophe.js'
import type { Sacrifice } from '../../actions/sacrifice.js'
import type { EndTurn } from '../../actions/endTurn.js'

export type PowerAction = Build | Move | Discover | Capture | Trade

export const engine = new GameEngine(HomeworldsRuntime)

export const MASTER_SEED = '0123456789abcdef0123456789abcdef'

export type HomeworldsConfig = { setup?: Setup; firstPlayer?: FirstPlayer }

// `userIds` gives seats a user; the game's creator is the user `ownerId`.
export function createGame(
    config: HomeworldsConfig = {},
    playerIds: string[] = ['first', 'second'],
    owner: { ownerId: string; userIds: Record<string, string> } = { ownerId: 'owner', userIds: {} }
) {
    return HomeworldsRuntime.initializer.initializeGame(
        {
            id: 'homeworlds-test',
            typeId: 'homeworlds',
            ownerId: owner.ownerId,
            seed: 5,
            config: {
                ...defaultGameConfig(HomeworldsInfo.configurator?.options ?? []),
                ...config
            },
            players: playerIds.map((id) => ({
                id,
                name: id,
                userId: owner.userIds[id],
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
}

export type HomeworldsGame = ReturnType<typeof createGame>

let counter = 0
export function actionBase(game: HomeworldsGame, playerId: string) {
    counter += 1
    return { id: `a${counter}`, gameId: game.id, source: ActionSource.User, playerId }
}

export function execute(game: HomeworldsGame, state: HomeworldsGameState, action: GameAction) {
    return engine.executeCanonicalAction({ game, state, action }).updatedState
}

export function powerAction(game: HomeworldsGame, playerId: string, use: PowerUse): PowerAction {
    const base = actionBase(game, playerId)
    switch (use.power) {
        case Power.Build:
            return { ...base, type: ActionType.Build, systemId: use.systemId, color: use.color }
        case Power.Move:
            return { ...base, type: ActionType.Move, ship: use.ship, systemId: use.systemId }
        case Power.Discover:
            return { ...base, type: ActionType.Discover, ship: use.ship, star: use.star }
        case Power.Capture:
            return { ...base, type: ActionType.Capture, ship: use.ship }
        case Power.Trade:
            return { ...base, type: ActionType.Trade, ship: use.ship, color: use.color }
    }
}

const ALL_KINDS: PieceKind[] = PYRAMID_COLORS.flatMap((color) =>
    PYRAMID_SIZES.map((size) => ({ color, size }))
)

// Every action the player to act may take.
export function legalActions(game: HomeworldsGame, state: HomeworldsGameState): GameAction[] {
    const hydrated = new HydratedHomeworldsGameState(state)
    const [playerId] = state.activePlayerIds
    if (playerId === undefined) return []
    const base = () => actionBase(game, playerId)
    if (hydrated.machineState === MachineState.SettingUp) {
        return ALL_KINDS.flatMap((first, index) =>
            ALL_KINDS.slice(index).flatMap((second) =>
                PYRAMID_COLORS.filter((ship) =>
                    hydrated.canCreateHomeworld(playerId, [first, second], ship)
                ).map((shipColor): CreateHomeworld => ({
                    ...base(),
                    type: ActionType.CreateHomeworld,
                    stars: [first, second],
                    shipColor
                }))
            )
        )
    }
    const catastrophes: GameAction[] = hydrated.starMap
        .overpopulations()
        .map(({ systemId, color }): Catastrophe => ({
            ...base(),
            type: ActionType.Catastrophe,
            systemId,
            color
        }))
    const endTurn: EndTurn = { ...base(), type: ActionType.EndTurn }
    if (hydrated.machineState === MachineState.FinishingTurn) return [...catastrophes, endTurn]
    const powers = [...hydrated.powerUses(playerId)].map((use) => powerAction(game, playerId, use))
    const sacrifices: GameAction[] =
        hydrated.machineState === MachineState.TakingTurn
            ? hydrated.starMap.systems.flatMap((system) =>
                  hydrated.starMap.ownShips(system, playerId).map((ship): Sacrifice => ({
                      ...base(),
                      type: ActionType.Sacrifice,
                      ship: ship.piece
                  }))
              )
            : []
    return [...powers, ...sacrifices, ...catastrophes, endTurn]
}

export const PLAYOUT_STEP_CAP = 4000

// Plays legal actions chosen by a seeded generator until the game ends. Ending the turn early is
// chosen rarely, so the fleets grow and fight rather than pass back and forth.
export function playToEnd(
    game: HomeworldsGame,
    state: HomeworldsGameState,
    seed: number
): HomeworldsGameState {
    let value = seed + 1
    const random = () => {
        value = (value * 1103515245 + 12345) % 2147483648
        return value / 2147483648
    }
    let steps = 0
    while (state.machineState !== MachineState.EndOfGame) {
        const actions = legalActions(game, state)
        if (actions.length === 0) throw Error(`No legal action after ${steps} steps`)
        const sensible = actions.filter((action) => !leavesHomeEmpty(state, action))
        const others = sensible.filter((action) => action.type !== ActionType.EndTurn)
        const pool =
            others.length > 0 && random() > 0.05 ? others : sensible.length > 0 ? sensible : actions
        const chosen = pool[Math.floor(random() * pool.length)]
        if (chosen === undefined) throw Error('No action chosen')
        state = execute(game, state, chosen)
        steps += 1
        if (steps > PLAYOUT_STEP_CAP) throw Error('The playout did not end')
    }
    return state
}

// Taking the last of one's ships away from home, or ending the turn with none there, loses
// at once; the playouts avoid it while anything else is open, so games run long enough to fight.
function leavesHomeEmpty(state: HomeworldsGameState, action: GameAction): boolean {
    const hydrated = new HydratedHomeworldsGameState(state)
    const playerId = action.playerId ?? ''
    if (action.type === ActionType.EndTurn) return hydrated.isOut(playerId)
    if (!('ship' in action) || typeof action.ship !== 'number') return false
    if (action.type === ActionType.Capture || action.type === ActionType.Trade) return false
    const home = hydrated.starMap.homeworldOf(playerId)
    if (home === undefined) return false
    const own = hydrated.starMap.ownShips(home, playerId)
    return own.length === 1 && own[0]?.piece === action.ship
}
