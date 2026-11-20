import { describe, expect, it } from 'vitest'
import { type Hits, outlineOf, SUPERSAMPLE } from './raymarch.js'

function grid(columns: number, rows: number, inside: (x: number, y: number) => boolean): Hits {
    const at = new Uint8Array(columns * rows)
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < columns; x++) at[y * columns + x] = inside(x, y) ? 1 : 0
    }
    return { columns, rows, at }
}

const BOX = { x: 0, y: 0, width: 10, height: 10 }
// Ten pixels across the box, so 30 supersamples.
const PIXELS = 30 / SUPERSAMPLE / 10

describe('outlineOf', () => {
    it('traces a disc as one closed loop round it', () => {
        const disc = grid(30, 30, (x, y) => Math.hypot(x - 15, y - 15) < 10)
        const path = outlineOf(disc, BOX, PIXELS)
        expect(path.match(/M/g)).toHaveLength(1)
        expect(path.match(/L/g)?.length).toBeGreaterThan(8)
        expect(path.endsWith('Z')).toBe(true)
        const xs = [...path.matchAll(/[ML](-?[\d.]+) /g)].map((match) => Number(match[1]))
        // A disc 20 supersamples across, a third of a unit each.
        expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(20 / 3, 0)
    })

    it('traces a ring as two loops, round its outside and its hole', () => {
        const ring = grid(30, 30, (x, y) => {
            const r = Math.hypot(x - 15, y - 15)
            return r < 12 && r > 5
        })
        expect(outlineOf(ring, BOX, PIXELS).match(/M/g)).toHaveLength(2)
    })

    it('keeps apart two shapes with a gap between them', () => {
        const two = grid(30, 10, (x, y) => y > 2 && y < 8 && (x < 10 || x > 20))
        expect(outlineOf(two, BOX, PIXELS).match(/M/g)).toHaveLength(2)
    })
})
