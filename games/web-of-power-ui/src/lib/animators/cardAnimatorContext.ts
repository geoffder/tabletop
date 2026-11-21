import { getContext, setContext } from 'svelte'
import type { CardAnimator } from './cardAnimator.svelte.js'
import type { PieceAnimator } from './pieceAnimator.svelte.js'
import type { ScoringAnimator } from './scoringAnimator.svelte.js'

// The table's card animator, for the tray and the player cards to register where cards are drawn.
const KEY = Symbol('web-of-power-card-animator')

export function setCardAnimator(animator: CardAnimator) {
    setContext(KEY, animator)
}

export function getCardAnimator(): CardAnimator | undefined {
    return getContext<CardAnimator | undefined>(KEY)
}

// The table's scoring animator, for the board to draw a scoring's beats and the player cards to
// count its points.
const SCORING_KEY = Symbol('web-of-power-scoring-animator')

export function setScoringAnimator(animator: ScoringAnimator) {
    setContext(SCORING_KEY, animator)
}

export function getScoringAnimator(): ScoringAnimator | undefined {
    return getContext<ScoringAnimator | undefined>(SCORING_KEY)
}

// The table's piece animator, for the board to draw the pieces it moves and the player cards to
// count the pieces left as they go down.
const PIECE_KEY = Symbol('web-of-power-piece-animator')

export function setPieceAnimator(animator: PieceAnimator) {
    setContext(PIECE_KEY, animator)
}

export function getPieceAnimator(): PieceAnimator | undefined {
    return getContext<PieceAnimator | undefined>(PIECE_KEY)
}
