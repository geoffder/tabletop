import type { GameProgress, GameProgression } from '@tabletop/common'
import { DECK_PASSES, DISPLAY_SIZE, type WebOfPowerProjectedState } from '../model/gameState.js'
import { deckFor } from '../model/map.js'
import { HAND_SIZE } from '../model/playerState.js'

const LAST_ROUND = 0.95
const PASS_NAMES = ['First pass', 'Second pass']

export class WebOfPowerProgression implements GameProgression<WebOfPowerProjectedState> {
    progress(state: WebOfPowerProjectedState): GameProgress {
        const pass = state.deckExhaustions
        if (pass >= DECK_PASSES) return { fraction: LAST_ROUND, label: 'Last round', final: true }
        // The second deck is the discard pile when the first ran out, which the state doesn't
        // keep; every card not in a hand or face up is near enough.
        const passSize =
            deckFor(state.players.length).length - HAND_SIZE * state.players.length - DISPLAY_SIZE
        const remaining = state.deck.remaining
        // An emptied first deck that hasn't been reshuffled yet starts the second pass.
        const drawn = remaining === 0 && pass > 0 ? 0 : Math.max(0, 1 - remaining / passSize)
        return {
            fraction: ((pass + drawn) / DECK_PASSES) * LAST_ROUND,
            label: `${PASS_NAMES[pass]} · ${remaining} ${remaining === 1 ? 'card' : 'cards'} left`
        }
    }
}
