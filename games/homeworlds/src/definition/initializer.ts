import {
    type GameInitializer,
    type StartingPositionAssignment,
    type UninitializedGameState,
    assertExists,
    BaseGameInitializer,
    Color,
    Game,
    HydratedTurnManager,
    Prng
} from '@tabletop/common'
import { HydratedHomeworldsGameState, HomeworldsGameState } from '../model/gameState.js'
import { HydratedHomeworldsPlayerState } from '../model/playerState.js'
import { MachineState } from './states.js'
import { FirstPlayer, firstPlayerFromConfig, Setup, setupFromConfig } from './config.js'
import { type PieceKind, PyramidColor, PyramidSize } from '../model/pieces.js'

export const SEAT_COLORS = [Color.Purple, Color.Orange] as const

// The rulebook's suggestion for a first game, by seat.
export const FIRST_GAME_HOMEWORLDS: readonly { stars: PieceKind[]; ship: PyramidColor }[] = [
    {
        stars: [
            { color: PyramidColor.Blue, size: PyramidSize.Large },
            { color: PyramidColor.Red, size: PyramidSize.Small }
        ],
        ship: PyramidColor.Green
    },
    {
        stars: [
            { color: PyramidColor.Red, size: PyramidSize.Medium },
            { color: PyramidColor.Blue, size: PyramidSize.Small }
        ],
        ship: PyramidColor.Green
    }
]

export class HomeworldsGameInitializer
    extends BaseGameInitializer<HomeworldsGameState, HydratedHomeworldsGameState>
    implements GameInitializer<HomeworldsGameState, HydratedHomeworldsGameState>
{
    readonly supportsStartingPositions = true

    initializeGameState(
        game: Game,
        state: UninitializedGameState,
        assignment?: StartingPositionAssignment
    ): HydratedHomeworldsGameState {
        const prng = new Prng(state.prng)
        const turnManager = HydratedTurnManager.generate(
            game.players.map((player) => ({ playerId: player.id, color: Color.Purple })),
            prng.random,
            assignment ?? this.chosenFirst(game)
        )
        turnManager.seriesKeeps = 'latest'

        const players = turnManager.turnOrder.map((playerId, seat) => {
            const color = SEAT_COLORS[seat]
            assertExists(color, 'Homeworlds seats two players')
            return new HydratedHomeworldsPlayerState({ playerId, color })
        })
        const firstGame = setupFromConfig(game.config) === Setup.FirstGame

        const gameState = new HydratedHomeworldsGameState(
            Object.assign(state, {
                players,
                machineState: firstGame ? MachineState.TakingTurn : MachineState.SettingUp,
                turnManager,
                starMap: { systems: [] },
                positions: []
            })
        )
        const [first] = gameState.turnManager.turnOrder
        assertExists(first, 'Homeworlds seats two players')
        gameState.turnManager.startTurn(first, 0)
        if (firstGame) {
            players.forEach((player, seat) => {
                const homeworld = FIRST_GAME_HOMEWORLDS[seat]
                assertExists(homeworld, 'Homeworlds seats two players')
                gameState.createHomeworld(player.playerId, homeworld.stars, homeworld.ship)
            })
            gameState.recordPosition(first)
        }
        return gameState
    }

    // In a local game every seat belongs to the creator's user, so the first listed seat counts
    // as the creator's. A creator who does not play leaves the first turn to the draw.
    private chosenFirst(game: Game): StartingPositionAssignment | undefined {
        const choice = firstPlayerFromConfig(game.config)
        const creator = game.players.find((player) => player.userId === game.ownerId)
        if (choice === FirstPlayer.Random || creator === undefined) {
            return undefined
        }
        const opponent = game.players.find((player) => player.id !== creator.id)
        assertExists(opponent, 'Homeworlds needs two players')
        const first = choice === FirstPlayer.Creator ? creator : opponent
        const second = first === creator ? opponent : creator
        return { playerIds: [first.id, second.id] }
    }
}
