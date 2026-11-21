// Filled outlines rather than strokes, so a road's width can swell and fray; the smudge is two
// translucent bands, not a blur (docs/phone-rendering.md).
import { mulberry32 } from './pieces.js'

type Point = [number, number]

export type RoadInk = {
    smudge: [string, string]
    ink: [string, string]
}

const SPACING = 4.5

export function samplePath(d: string, spacing = SPACING): Point[] {
    const numbers = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
    const points: Point[] = [[numbers[0], numbers[1]]]
    if (!d.includes('C')) {
        const [ax, ay] = points[0]
        const [bx, by] = [numbers[2], numbers[3]]
        const steps = Math.max(2, Math.round(Math.hypot(bx - ax, by - ay) / spacing))
        for (let k = 1; k <= steps; k++)
            points.push([ax + ((bx - ax) * k) / steps, ay + ((by - ay) * k) / steps])
        return points
    }
    for (let i = 2; i + 5 < numbers.length; i += 6) {
        const [x0, y0] = points[points.length - 1]
        const [c1x, c1y, c2x, c2y, x3, y3] = numbers.slice(i, i + 6)
        const at = (t: number): Point => {
            const u = 1 - t
            return [
                u * u * u * x0 + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * x3,
                u * u * u * y0 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y3
            ]
        }
        const reach =
            Math.hypot(c1x - x0, c1y - y0) +
            Math.hypot(c2x - c1x, c2y - c1y) +
            Math.hypot(x3 - c2x, y3 - c2y)
        const steps = Math.max(2, Math.round(reach / spacing))
        for (let k = 1; k <= steps; k++) points.push(at(k / steps))
    }
    return points
}

export function roadInk(d: string, seed: number): RoadInk {
    const random = mulberry32(seed * 6271 + 17)
    const points = samplePath(d)
    const n = points.length - 1
    const normals = points.map((_, i) => {
        const [ax, ay] = points[Math.max(0, i - 1)]
        const [bx, by] = points[Math.min(n, i + 1)]
        const length = Math.hypot(bx - ax, by - ay) || 1
        return [-(by - ay) / length, (bx - ax) / length]
    })
    const wave = (amount: number) => {
        const out: number[] = []
        let value = 0
        let drift = 0
        for (let i = 0; i <= n; i++) {
            drift = drift * 0.8 + (random() * 2 - 1) * 0.35
            value = value * 0.9 + drift
            out.push(value * amount)
        }
        return out
    }
    const ragged = () => points.map(() => (random() * 2 - 1) * 0.28)
    const course = wave(0.12)
    const pressure = wave(0.1)

    const band = (half: (i: number) => number, sway: number[], stride = 1) => {
        const left = ragged()
        const right = ragged()
        // Path data size, not the arithmetic, is what costs on opening, so soft bands skip samples.
        const kept = points.flatMap((_, i) => (i % stride === 0 || i === n ? [i] : []))
        const side = (sign: number, fray: number[]) =>
            kept.map((i) => {
                const [x, y] = points[i]
                const t = i / n
                const taper = Math.min(1, t / 0.04, (1 - t) / 0.04)
                const offset = sway[i] + sign * (half(i) * (0.65 + 0.35 * taper) + fray[i])
                return `${(x + normals[i][0] * offset).toFixed(1)} ${(y + normals[i][1] * offset).toFixed(1)}`
            })
        return `M${side(1, left).join('L')}L${side(-1, right).reverse().join('L')}Z`
    }

    const smudgeWide = wave(0.35)
    const smudgeNarrow = wave(0.35)
    const second = wave(0.18)
    return {
        smudge: [
            band(
                () => 4.4,
                smudgeWide.map((value, i) => value + course[i]),
                3
            ),
            band(
                () => 3.2,
                smudgeNarrow.map((value, i) => value + course[i]),
                3
            )
        ],
        ink: [
            band(
                (i) => 1.05 * (1 + pressure[i]),
                course.map((value) => value - 0.7)
            ),
            band(
                (i) => 0.9 * (1 - pressure[i]),
                second.map((value, i) => value + course[i] + 0.8)
            )
        ]
    }
}

const DASH = 15
const GAP = 7
const DOT = 1.6

export function seaRouteInk(d: string, seed: number): string {
    const random = mulberry32(seed * 4423 + 29)
    const points = samplePath(d, 1.5)
    const along = [0]
    for (let i = 1; i < points.length; i++) {
        along.push(
            along[i - 1] +
                Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1])
        )
    }
    const normalAt = (i: number) => {
        const [ax, ay] = points[Math.max(0, i - 1)]
        const [bx, by] = points[Math.min(points.length - 1, i + 1)]
        const length = Math.hypot(bx - ax, by - ay) || 1
        return [-(by - ay) / length, (bx - ax) / length]
    }
    const indexAt = (distance: number) => {
        let i = 0
        while (i < along.length - 1 && along[i] < distance) i++
        return i
    }
    const pieces: string[] = []
    const total = along[along.length - 1]
    let at = 0
    while (at < total) {
        const from = indexAt(at)
        const to = indexAt(Math.min(total, at + DASH))
        if (to > from) {
            const swell = 1.45 + random() * 0.3
            const side = (sign: number) =>
                points.slice(from, to + 1).map(([x, y], k) => {
                    const i = from + k
                    const t = k / (to - from)
                    const taper = Math.min(1, t / 0.2, (1 - t) / 0.2)
                    const half = swell * (0.45 + 0.55 * taper) + (random() * 2 - 1) * 0.25
                    const [nx, ny] = normalAt(i)
                    return `${(x + nx * sign * half).toFixed(1)} ${(y + ny * sign * half).toFixed(1)}`
                })
            pieces.push(`M${side(1).join('L')}L${side(-1).reverse().join('L')}Z`)
        }
        at += DASH + GAP
        if (at >= total) break
        const [x, y] = points[indexAt(at)]
        const corners = Array.from({ length: 7 }, (_, k) => {
            const angle = (k / 7) * Math.PI * 2
            const r = DOT * (0.8 + random() * 0.4)
            return `${(x + Math.cos(angle) * r).toFixed(1)} ${(y + Math.sin(angle) * r).toFixed(1)}`
        })
        pieces.push(`M${corners.join('L')}Z`)
        at += GAP
    }
    return pieces.join(' ')
}
