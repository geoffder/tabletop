import * as Type from 'typebox'
import type { HydratedMexicaGameState } from '../model/gameState.js'

export type PaidMetadata = Type.Static<typeof PaidMetadata>
export const PaidMetadata = Type.Object({
    // Action tokens given back to pay what the turn's own points could not.
    tokensSpent: Type.Integer({ minimum: 0 })
})

export function payFor(
    state: HydratedMexicaGameState,
    playerId: string,
    cost: number
): PaidMetadata {
    const before = state.getPlayerState(playerId).actionTokens
    state.pay(playerId, cost)
    return { tokensSpent: before - state.getPlayerState(playerId).actionTokens }
}
