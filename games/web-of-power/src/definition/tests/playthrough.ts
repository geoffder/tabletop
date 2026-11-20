import {
    ActionSource,
    assert,
    defaultGameConfig,
    GameEngine,
    PlayerStatus,
    type GameAction
} from '@tabletop/common'
import { Definition } from '../definition.js'
import { WebOfPowerRuntime } from '../runtime.js'
import { WebOfPowerInfo } from '../info.js'
import { fasterVariantFromConfig, type WebOfPowerGameConfig } from '../config.js'
import { MachineState } from '../states.js'
import { ActionType } from '../actions.js'
import {
    HydratedWebOfPowerGameState,
    WebOfPowerGameStateValidator,
    type WebOfPowerGameState
} from '../../model/gameState.js'

export const MASTER_SEED = '0123456789abcdef0123456789abcdef'
export const engine = new GameEngine(WebOfPowerRuntime)

// `userIds` gives seats a user; the game's creator is the user `ownerId`.
export function createGame(
    config: WebOfPowerGameConfig = {},
    playerIds: string[] = ['anna', 'barbara', 'chris', 'dan'],
    owner: { ownerId: string; userIds: Record<string, string> } = { ownerId: 'owner', userIds: {} }
) {
    return WebOfPowerRuntime.initializer.initializeGame(
        {
            id: 'web-of-power-test',
            typeId: 'web-of-power',
            ownerId: owner.ownerId,
            seed: 5,
            config: {
                ...defaultGameConfig(WebOfPowerInfo.configurator?.options ?? []),
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

export type WebOfPowerGame = ReturnType<typeof createGame>

export function startGame(
    game: WebOfPowerGame,
    masterSeed = MASTER_SEED,
    playerIds?: string[]
): WebOfPowerGameState {
    const { initialState } = engine.startGame(game, {
        masterSeed,
        ...(playerIds ? { startingPositions: { playerIds } } : {})
    })
    assert(WebOfPowerGameStateValidator.Check(initialState), 'The started game is canonical')
    return initialState
}

let counter = 0
export function actionBase(game: WebOfPowerGame, playerId: string) {
    counter += 1
    return { id: `a${counter}`, gameId: game.id, source: ActionSource.User, playerId }
}

export function execute(
    game: WebOfPowerGame,
    state: WebOfPowerGameState,
    action: GameAction
): { updatedState: WebOfPowerGameState; processedActions: GameAction[] } {
    const { updatedState, processedActions } = engine.executeCanonicalAction({
        game,
        state,
        action
    })
    assert(WebOfPowerGameStateValidator.Check(updatedState), 'Play keeps state canonical')
    return { updatedState, processedActions }
}

export function act(
    game: WebOfPowerGame,
    state: WebOfPowerGameState,
    type: ActionType,
    fields: Record<string, unknown> = {}
): WebOfPowerGameState {
    const [playerId] = state.activePlayerIds
    return execute(game, state, { ...actionBase(game, playerId), type, ...fields }).updatedState
}

// Every action the player to act may take.
export function legalActions(game: WebOfPowerGame, state: WebOfPowerGameState): GameAction[] {
    const hydrated = new HydratedWebOfPowerGameState(state)
    const [playerId] = state.activePlayerIds
    const base = () => actionBase(game, playerId)
    const player = hydrated.getPlayerState(playerId)
    if (state.machineState === MachineState.Drawing) {
        return [
            ...[...new Set(state.display)].map((card) => ({
                ...base(),
                type: ActionType.DrawFaceUp,
                card
            })),
            ...(state.deck.remaining > 0
                ? [{ ...base(), type: ActionType.DrawFromDeck, revealsInfo: true }]
                : [])
        ]
    }
    const faster = fasterVariantFromConfig(game.config)
    const placements = hydrated.targets(playerId, faster).flatMap((target) =>
        hydrated.payments(playerId, target.country).map((cards) => ({
            ...base(),
            type: ActionType.PlacePiece,
            cards,
            ...target
        }))
    )
    const others: GameAction[] =
        state.placements.length > 0
            ? [{ ...base(), type: ActionType.EndPlacing }]
            : [
                  ...(hydrated.canDraw()
                      ? [...new Set(player.knownHand())].map((card) => ({
                            ...base(),
                            type: ActionType.ExchangeCard,
                            card
                        }))
                      : []),
                  ...(hydrated.isFinalRound() ? [{ ...base(), type: ActionType.Pass }] : [])
              ]
    return [...placements, ...others]
}

// Plays legal actions chosen by a seeded generator until the game ends. Placing is favoured over
// exchanging, as players do, so the board fills.
export function playToEnd(
    game: WebOfPowerGame,
    state: WebOfPowerGameState,
    seed: number,
    maxSteps = 5000
): WebOfPowerGameState {
    let value = seed + 1
    const choose = <T>(options: T[]): T => {
        value = (value * 1103515245 + 12345) % 2147483648
        return options[value % options.length]
    }
    let steps = 0
    while (state.machineState !== MachineState.EndOfGame) {
        const actions = legalActions(game, state)
        if (actions.length === 0) throw Error(`No legal action after ${steps} steps`)
        const placing = actions.filter((action) => action.type === ActionType.PlacePiece)
        const pick = placing.length > 0 && choose([true, true, true, false]) ? placing : actions
        state = execute(game, state, choose(pick)).updatedState
        steps += 1
        if (steps >= maxSteps) throw Error('The playout did not end')
    }
    return state
}
