import type { GameScoring } from '@tabletop/common'
import type { MexicaGameState } from '../model/gameState.js'

export class MexicaScoring implements GameScoring<MexicaGameState> {
    finalScores(state: MexicaGameState): Record<string, number> {
        return Object.fromEntries(state.players.map((player) => [player.playerId, player.score]))
    }
}
