import type { GameScoring } from '@tabletop/common'
import type { WebOfPowerProjectedState } from '../model/gameState.js'

export class WebOfPowerScoring implements GameScoring<WebOfPowerProjectedState> {
    finalScores(state: WebOfPowerProjectedState): Record<string, number> {
        return Object.fromEntries(state.players.map((player) => [player.playerId, player.score]))
    }
}
