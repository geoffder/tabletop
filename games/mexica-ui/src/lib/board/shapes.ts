import type { Point } from '@tabletop/common'
import { Axis } from '@tabletop/mexica'
import { BRIDGE_RISE, CELL, type BoardView } from './view.js'

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
