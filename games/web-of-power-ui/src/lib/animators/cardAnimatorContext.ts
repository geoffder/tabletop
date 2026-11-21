import { getContext, setContext } from 'svelte'
import type { CardAnimator } from './cardAnimator.svelte.js'

// The table's card animator, for the tray and the player cards to register where cards are drawn.
const KEY = Symbol('web-of-power-card-animator')

export function setCardAnimator(animator: CardAnimator) {
    setContext(KEY, animator)
}

export function getCardAnimator(): CardAnimator | undefined {
    return getContext<CardAnimator | undefined>(KEY)
}
