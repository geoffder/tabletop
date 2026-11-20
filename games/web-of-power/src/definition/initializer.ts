import {
    type GameInitializer,
    type StartingPositionAssignment,
    type UninitializedGameState,
    BaseGameInitializer,
    Game,
    HydratedTurnManager,
    Prng,
    shuffle
} from '@tabletop/common'
import {
    HydratedWebOfPowerGameState,
    DISPLAY_SIZE,
    type WebOfPowerProjectedState
} from '../model/gameState.js'
import { HAND_SIZE, type WebOfPowerPlayerState } from '../model/playerState.js'
import { deckFor } from '../model/map.js'
import { MachineState } from './states.js'
import { WebOfPowerColors } from './colors.js'

export class WebOfPowerGameInitializer
    extends BaseGameInitializer<WebOfPowerProjectedState, HydratedWebOfPowerGameState>
    implements GameInitializer<WebOfPowerProjectedState, HydratedWebOfPowerGameState>
{
    readonly supportsStartingPositions = true

    // The first in turn order starts and holds the black marker; the last round ends with the
    // player before them.
    initializeGameState(
        game: Game,
        state: UninitializedGameState,
        assignment?: StartingPositionAssignment
    ): HydratedWebOfPowerGameState {
        const prng = new Prng(state.prng)
        const colors = structuredClone(WebOfPowerColors)
        shuffle(colors, prng.random)
        const turnManager = HydratedTurnManager.generate(
            game.players.map((player, index) => ({ playerId: player.id, color: colors[index] })),
            prng.random,
            assignment
        )
        turnManager.seriesKeeps = 'latest'

        // Colours go with the seats, so an assigned order changes only who sits where.
        const players: WebOfPowerPlayerState[] = turnManager.turnOrder.map((playerId, seat) => ({
            playerId,
            color: colors[seat],
            hand: [],
            handCount: 0,
            score: 0
        }))
        const deck = deckFor(players.length)

        const hydrated = new HydratedWebOfPowerGameState(
            Object.assign(state, {
                players,
                machineState: MachineState.PlacingPieces,
                turnManager,
                cloisters: [],
                advisors: [],
                deck: { items: deck, remaining: deck.length },
                display: [],
                discard: [],
                deckExhaustions: 0,
                placements: []
            })
        )
        // Shuffle with the hydrated state's own protected generator, so its draws are saved.
        hydrated.deck.shuffle(hydrated.getProtectedPrng().random)
        for (const player of hydrated.players) {
            for (let dealt = 0; dealt < HAND_SIZE; dealt++) player.takeCard(hydrated.deck.draw())
        }
        for (let dealt = 0; dealt < DISPLAY_SIZE; dealt++)
            hydrated.display.push(hydrated.deck.draw())
        hydrated.turnManager.startTurn(hydrated.turnManager.turnOrder[0], 0)
        return hydrated
    }
}
