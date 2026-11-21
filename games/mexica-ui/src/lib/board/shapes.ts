import type { Point } from '@tabletop/common'
import type { BoardView } from './view.js'

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
