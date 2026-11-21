import { getContext, setContext } from 'svelte'
import type { CardAnimator } from './cardAnimator.svelte.js'
import type { PieceAnimator } from './pieceAnimator.svelte.js'
import type { ScoringAnimator } from './scoringAnimator.svelte.js'

const KEY = Symbol('web-of-power-card-animator')

export function setCardAnimator(animator: CardAnimator) {
    setContext(KEY, animator)
}

export function getCardAnimator(): CardAnimator | undefined {
    return getContext<CardAnimator | undefined>(KEY)
}

const SCORING_KEY = Symbol('web-of-power-scoring-animator')

export function setScoringAnimator(animator: ScoringAnimator) {
    setContext(SCORING_KEY, animator)
}

export function getScoringAnimator(): ScoringAnimator | undefined {
    return getContext<ScoringAnimator | undefined>(SCORING_KEY)
}

const PIECE_KEY = Symbol('web-of-power-piece-animator')

export function setPieceAnimator(animator: PieceAnimator) {
    setContext(PIECE_KEY, animator)
}

export function getPieceAnimator(): PieceAnimator | undefined {
    return getContext<PieceAnimator | undefined>(PIECE_KEY)
}
