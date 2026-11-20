import {
    type GameInitializer,
    type RandomFunction,
    type StartingPositionAssignment,
    type UninitializedGameState,
    BaseGameInitializer,
    Game,
    HydratedTurnManager,
    Prng,
    shuffle
} from '@tabletop/common'
import { HydratedMexicaGameState, type MexicaGameState } from '../model/gameState.js'
import type { MexicaPlayerState } from '../model/playerState.js'
import {
    type Cell,
    isPalace,
    LAND_CELLS,
    manhattan,
    STARTING_CANALS,
    touchesLake
} from '../model/board.js'
import {
    BASE_AP,
    DISTRICT_SIZES,
    FIRST_PERIOD_DISTRICTS,
    NEUTRAL_LEVELS,
    NEUTRAL_SPACING,
    type Temple,
    tokenSize
} from '../model/pieces.js'
import { MachineState } from './states.js'
import { MexicaColors } from './colors.js'
import { neutralTemplesFromConfig } from './config.js'

export class MexicaGameInitializer
    extends BaseGameInitializer<MexicaGameState, HydratedMexicaGameState>
    implements GameInitializer<MexicaGameState, HydratedMexicaGameState>
{
    readonly supportsStartingPositions = true

    initializeGameState(
        game: Game,
        state: UninitializedGameState,
        assignment?: StartingPositionAssignment
    ): HydratedMexicaGameState {
        const prng = new Prng(state.prng)
        const colors = structuredClone(MexicaColors)
        shuffle(colors, prng.random)
        const turnManager = HydratedTurnManager.generate(
            game.players.map((player, index) => ({ playerId: player.id, color: colors[index] })),
            prng.random,
            assignment
        )
        turnManager.seriesKeeps = 'latest'

        // Colours go with the seats, so an assigned order changes only who sits where.
        const players: MexicaPlayerState[] = turnManager.turnOrder.map((playerId, seat) => ({
            playerId,
            color: colors[seat],
            score: 0,
            actionTokens: 0
        }))

        const tokens = DISTRICT_SIZES.map((_, tokenId) => tokenId)
        shuffle(tokens, prng.random)
        const bySize = (a: number, b: number) => tokenSize(a) - tokenSize(b) || a - b
        const display = tokens.slice(0, FIRST_PERIOD_DISTRICTS).sort(bySize)
        const reserve = tokens.slice(FIRST_PERIOD_DISTRICTS).sort(bySize)

        const neutral = players.length === 2 && neutralTemplesFromConfig(game.config)
        const temples = neutral ? neutralTemples(prng.random) : []

        const hydrated = new HydratedMexicaGameState(
            Object.assign(state, {
                players,
                machineState: MachineState.ChoosingStart,
                turnManager,
                canals: STARTING_CANALS.map((cells) => ({ cells: [...cells] })),
                bridges: [],
                temples,
                districts: [],
                display,
                reserve,
                period: 1,
                apLeft: BASE_AP,
                tokensTaken: 0,
                acted: false,
                idleTurns: 0
            })
        )
        hydrated.turnManager.startTurn(hydrated.turnManager.turnOrder[0], 0)
        return hydrated
    }
}

// The neutral temples go at random on land away from the lake and the palace, each at least
// five steps from the others.
function neutralTemples(random: RandomFunction): Temple[] {
    const dug = STARTING_CANALS.flat()
    const candidates = LAND_CELLS.filter(
        (cell) => !isPalace(cell) && !touchesLake(cell) && !dug.includes(cell)
    )
    for (let attempt = 0; attempt < 100; attempt++) {
        const order = [...candidates]
        shuffle(order, random)
        const chosen: Cell[] = []
        for (const cell of order) {
            if (chosen.every((other) => manhattan(cell, other) >= NEUTRAL_SPACING))
                chosen.push(cell)
            if (chosen.length === NEUTRAL_LEVELS.length) break
        }
        if (chosen.length === NEUTRAL_LEVELS.length) {
            return chosen.map((cell, index) => ({ cell, level: NEUTRAL_LEVELS[index] }))
        }
    }
    throw Error('The neutral temples must fit on the island')
}
