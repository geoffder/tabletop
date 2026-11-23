import { describe, expect, it } from 'vitest'
import { evenColumns, fitPills, type PillMeasures } from './pillRows.js'

const pills = (count: number, width = 80): PillMeasures => ({
    widths: Array.from({ length: count }, () => width),
    pillHeight: 24,
    headWidth: 50,
    headHeight: 20,
    headGap: 4,
    columnGap: 6,
    rowGap: 4
})

describe('pill rows', () => {
    it('keeps rows as even as they come', () => {
        expect([1, 2, 3, 4, 5, 7, 9, 10].map((count) => evenColumns(count, 3))).toEqual([
            1, 2, 3, 2, 3, 3, 3, 3
        ])
    })

    it('puts up to three to a row at full size when they fit', () => {
        expect(fitPills(pills(7), { width: 300, height: 120 })).toEqual({ columns: 3, scale: 1 })
        expect(fitPills(pills(4), { width: 300, height: 120 })).toEqual({ columns: 2, scale: 1 })
    })

    it('takes more columns of smaller pills for a long turn', () => {
        // Twelve in rows of three need 4 rows (126 px); rows of four fit 3 rows at a larger scale.
        const fit = fitPills(pills(12), { width: 300, height: 100 })
        expect(fit.columns).toBe(4)
        expect(fit.scale).toBeLessThan(1)
        expect(fit.scale * (4 * 80 + 3 * 6)).toBeLessThanOrEqual(300)
        expect(fit.scale * (20 + 4 + 3 * 24 + 2 * 4)).toBeLessThanOrEqual(100)
    })

    it('shrinks the full-size layout when the card is narrow', () => {
        const fit = fitPills(pills(3, 120), { width: 300, height: 120 })
        expect(fit.columns).toBe(3)
        expect(fit.scale).toBeCloseTo(300 / (3 * 120 + 2 * 6))
    })
})
