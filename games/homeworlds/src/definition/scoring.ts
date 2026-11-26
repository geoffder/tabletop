import type { GameScoring } from '@tabletop/common'
import type { HomeworldsGameState } from '../model/gameState.js'

export class HomeworldsScoring implements GameScoring<HomeworldsGameState> {
    finalScores(state: HomeworldsGameState): Record<string, number> {
        return Object.fromEntries(
            state.players.map((player) => [
                player.playerId,
                state.winningPlayerIds.includes(player.playerId) ? 1 : 0
            ])
        )
    }
}
