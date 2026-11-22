import { riseOf } from './templeShape.js'
import { CELL, type Box } from './view.js'

// A calpulli token: a thick octagon of gold lying on the ground with flat sides square to the
// board, a raised rim round a sunken face where its numbers are written. Drawn once at the size
// the Emperor's display shows it, `radius` to its corners, and scaled down for the board.
export const TOKEN_INK = '#3b2708'

// A founded district's token on the board, `radius` to its corners.
export const TOKEN_ON_BOARD = 0.5 * CELL

// The Emperor's display: each slot's side in squares, and a token on it, `radius` to its corners.
export const DISPLAY_SLOT = 1.5
export const TOKEN_ON_DISPLAY = 0.4 * DISPLAY_SLOT * CELL

export const TOKEN = {
    radius: 0.4 * 1.42 * CELL,
    height: 3.6,
    round: 0.9,
    rim: 2.4,
    sink: 0.6
}

// Around the token's centre on the ground.
export function tokenBounds(tilt: number): Box {
    const margin = 1
    const half = TOKEN.radius
    const top = -half * tilt - TOKEN.height * riseOf(tilt)
    return {
        x: -half - margin,
        y: top - margin,
        width: 2 * (half + margin),
        height: half * tilt - top + 2 * margin
    }
}

// How high the token's face lies, in screen units.
export function tokenFaceLift(tilt: number): number {
    return (TOKEN.height - TOKEN.sink) * riseOf(tilt)
}

export function tokenLook(flat: boolean): string {
    return `token${flat ? '-flat' : ''}`
}
