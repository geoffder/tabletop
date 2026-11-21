// The alliance tags, drawn as scraps of worn parchment: edges that waver, a nick or two cut into
// them and one chipped corner, each tag its own (`seed`). The outline is in the tag's units about its
// middle, 32 across; the board draws it twice, a shadow offset below, then the scrap.

import { mulberry32 } from './pieces.js'

const point = (x: number, y: number) => `${x.toFixed(2)} ${y.toFixed(2)}`

export const TAG_HALF = 16

export function wornTag(seed: number): string {
    const random = mulberry32(seed * 7907 + 101)
    const jitter = (amount: number) => (random() * 2 - 1) * amount
    const H = TAG_HALF
    const corners: [number, number][] = [
        [-H, -H],
        [H, -H],
        [H, H],
        [-H, H]
    ]
    const chipped = Math.floor(random() * 4)
    const nicked = new Set([Math.floor(random() * 4), Math.floor(random() * 4)])
    const points: [number, number][] = []
    for (let edge = 0; edge < 4; edge++) {
        const [ax, ay] = corners[edge]
        const [bx, by] = corners[(edge + 1) % 4]
        // inward, across the edge
        const nx = -(by - ay) / (2 * H)
        const ny = (bx - ax) / (2 * H)
        const nickAt = nicked.has(edge) ? 0.25 + random() * 0.5 : -1
        for (let step = 0; step < 10; step++) {
            const t = step / 10
            let x = ax + (bx - ax) * t
            let y = ay + (by - ay) * t
            if (step === 0) {
                // a chipped corner starts a little along its edge
                if (edge === chipped) {
                    x += (bx - ax) * 0.06
                    y += (by - ay) * 0.06
                }
                points.push([x + jitter(0.3), y + jitter(0.3)])
                continue
            }
            const off = jitter(0.45)
            points.push([x + nx * off, y + ny * off])
            if (nickAt > 0 && Math.abs(t - nickAt) < 0.05) {
                const depth = 1.8 + random() * 1.4
                points.push([
                    x + (bx - ax) * 0.035 + nx * depth,
                    y + (by - ay) * 0.035 + ny * depth
                ])
            }
        }
    }
    return points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${point(x, y)}`).join('') + 'Z'
}
