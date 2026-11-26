import type { Point } from '@tabletop/common'

// The convex hull, by Andrew's monotone chain.
export function hull(points: readonly Point[]): Point[] {
    const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y)
    const turnsLeft = (o: Point, a: Point, b: Point) =>
        (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x) > 0
    const chain = (list: Point[]) => {
        const result: Point[] = []
        for (const point of list) {
            for (
                let last = result.at(-1), before = result.at(-2);
                last && before && !turnsLeft(before, last, point);
                last = result.at(-1), before = result.at(-2)
            ) {
                result.pop()
            }
            result.push(point)
        }
        result.pop()
        return result
    }
    return [...chain(sorted), ...chain(sorted.toReversed())]
}

// Whether two convex shapes come within `gap` of each other: no edge of either separates them.
export function convexNear(a: readonly Point[], b: readonly Point[], gap: number): boolean {
    for (const shape of [a, b]) {
        for (let index = 0; index < shape.length; index++) {
            const from = shape[index]
            const to = shape[(index + 1) % shape.length]
            if (from === undefined || to === undefined) continue
            const length = Math.hypot(to.x - from.x, to.y - from.y)
            if (length === 0) continue
            const axis = { x: (from.y - to.y) / length, y: (to.x - from.x) / length }
            const span = (points: readonly Point[]) => {
                let low = Infinity
                let high = -Infinity
                for (const point of points) {
                    const along = point.x * axis.x + point.y * axis.y
                    low = Math.min(low, along)
                    high = Math.max(high, along)
                }
                return { low, high }
            }
            const first = span(a)
            const second = span(b)
            if (first.high + gap < second.low || second.high + gap < first.low) return false
        }
    }
    return true
}
