import { boardView, type QuarterTurns } from './view.js'

const MOST_FIT = 1.5
const MOST_ZOOM = 4
// docs/phone-rendering.md: zoomed in, a phone draws the whole board at this width or more.
const MOST_DRAWN = 5500

export type ZoomLimits = { maxScale: number; maxFitScale: number }

const TURNS: readonly QuarterTurns[] = [0, 1, 2, 3]

const WIDEST = Math.max(
    ...[false, true].flatMap((flat) => TURNS.map((turns) => boardView(flat, turns).frame.width))
)

export function zoomLimits(pixelRatio: number): ZoomLimits {
    const maxScale = Math.min(MOST_ZOOM, MOST_DRAWN / (pixelRatio * WIDEST))
    return { maxScale, maxFitScale: Math.min(MOST_FIT, maxScale) }
}
