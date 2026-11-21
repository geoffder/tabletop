import { describe, expect, it } from 'vitest'
import { ROAD_PATHS } from './mapData.js'
import { roadInk, samplePath } from './roadInk.js'

describe('road ink', () => {
    it('samples a road from its start to its end', () => {
        const d = ROAD_PATHS['ford|waverley']
        const points = samplePath(d)
        const numbers = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
        expect(points[0]).toEqual([numbers[0], numbers[1]])
        const [x, y] = points[points.length - 1]
        expect(x).toBeCloseTo(numbers[numbers.length - 2])
        expect(y).toBeCloseTo(numbers[numbers.length - 1])
    })

    it('draws every road as closed outlines with no gaps in the numbers', () => {
        Object.values(ROAD_PATHS).forEach((d, index) => {
            const { smudge, ink } = roadInk(d, index + 1)
            for (const outline of [...smudge, ...ink]) {
                expect(outline).toMatch(/^M.*Z$/)
                expect(outline).not.toMatch(/NaN|Infinity/)
            }
        })
    })

    it('draws the same road the same way every time', () => {
        const d = ROAD_PATHS['ford|waverley']
        expect(roadInk(d, 3)).toEqual(roadInk(d, 3))
    })
})
