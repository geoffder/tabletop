import { describe, expect, it } from 'vitest'
import { polygonsPath, rectsPath } from './mergedPaths.js'

describe('merged paths', () => {
    it('draws each box as a closed clockwise ring', () => {
        expect(
            rectsPath([
                { x: 0, y: 0, width: 2, height: 3 },
                { x: 5, y: 1, width: 1, height: 1 }
            ])
        ).toBe('M0 0h2v3h-2zM5 1h1v1h-1z')
    })

    it('winds every polygon clockwise, so overlaps fill as one shape', () => {
        const clockwise = '0,0 4,0 4,4 0,4'
        const anticlockwise = '0,0 0,4 4,4 4,0'
        expect(polygonsPath([clockwise])).toBe('M0 0L4 0L4 4L0 4z')
        expect(polygonsPath([anticlockwise])).toBe('M4 0L4 4L0 4L0 0z')
    })

    it('reads points separated by commas or spaces', () => {
        expect(polygonsPath(['0 0, 2 0, 2 2'])).toBe('M0 0L2 0L2 2z')
    })

    it('is empty for no shapes', () => {
        expect(rectsPath([])).toBe('')
        expect(polygonsPath([])).toBe('')
    })
})
