import type { Point } from '@tabletop/common'
import { Axis } from '@tabletop/mexica'
import { BRIDGE_RISE, CELL, PILLI_HEIGHT, type BoardView } from './view.js'

// A Pilli Mexica: a noble with a feathered headdress, feet at the origin, 33 units tall.
export const PILLI_PATH =
    'M0 -23 C3.3 -23 6 -20.3 6 -17 C6 -15.3 5.3 -13.8 4.2 -12.7 L12 -10 C13.5 -9.5 14 -8 13 -6.8 L9 -3.5 L11 0 L3 0 L0 -4 L-3 0 L-11 0 L-9 -3.5 L-13 -6.8 C-14 -8 -13.5 -9.5 -12 -10 L-4.2 -12.7 C-5.3 -13.8 -6 -15.3 -6 -17 C-6 -20.3 -3.3 -23 0 -23 Z'
export const PLUME_PATH =
    'M-6.5 -20 L-11 -29 L-4 -24.5 L0 -33 L4 -24.5 L11 -29 L6.5 -20 C4 -23.5 -4 -23.5 -6.5 -20 Z'
export const PILLI_SCALE = PILLI_HEIGHT / 33

// A bridge across its canal: a plank with ramps running along the axis, raised in the middle.
export function bridgePaths(
    view: BoardView,
    centre: Point,
    axis: Axis
): { top: string; near?: string; far?: string; body?: string } {
    const rise = view.lift(BRIDGE_RISE)
    if (axis === Axis.EastWest) {
        const half = 0.62 * CELL
        const depth = 0.22 * CELL * view.tilt
        const archHalf = 0.28 * CELL
        const front = centre.y + depth
        const body = [
            `M${centre.x - half} ${front}`,
            `L${centre.x - archHalf * 1.4} ${front - rise}`,
            `L${centre.x + archHalf * 1.4} ${front - rise}`,
            `L${centre.x + half} ${front}`,
            `L${centre.x + archHalf} ${front}`,
            `Q${centre.x} ${front - rise * 1.5} ${centre.x - archHalf} ${front}`,
            'Z'
        ].join(' ')
        const top = [
            `M${centre.x - half} ${front}`,
            `L${centre.x - archHalf * 1.4} ${front - rise}`,
            `L${centre.x + archHalf * 1.4} ${front - rise}`,
            `L${centre.x + half} ${front}`,
            `L${centre.x + half} ${front - depth * 2}`,
            `L${centre.x + archHalf * 1.4} ${front - depth * 2 - rise}`,
            `L${centre.x - archHalf * 1.4} ${front - depth * 2 - rise}`,
            `L${centre.x - half} ${front - depth * 2}`,
            'Z'
        ].join(' ')
        return { body, top }
    }
    const half = 0.24 * CELL
    const reach = 0.62 * CELL * view.tilt
    const mid = 0.24 * CELL * view.tilt
    const deckNear = centre.y + mid - rise
    const deckFar = centre.y - mid - rise
    const quad = (y1: number, y2: number) =>
        `M${centre.x - half} ${y1} L${centre.x + half} ${y1} L${centre.x + half} ${y2} L${centre.x - half} ${y2} Z`
    return {
        top: quad(deckNear, deckFar),
        near: quad(centre.y + reach, deckNear),
        far: quad(deckFar, centre.y - reach)
    }
}

// A calpulli token: an octagon lying on the ground.
export function octagon(view: BoardView, centre: Point, radius: number, lift = 0): string {
    const points: string[] = []
    for (let i = 0; i < 8; i++) {
        const angle = ((i + 0.5) * Math.PI) / 4
        points.push(
            `${centre.x + Math.cos(angle) * radius},${centre.y + Math.sin(angle) * radius * view.tilt - lift}`
        )
    }
    return points.join(' ')
}
