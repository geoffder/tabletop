// The two pieces, drawn standing on the map: a cloister is a small house, an advisor a peg.

// A house seen from the front, its foot on the space's point.
export const HOUSE_PATH = 'M-17 7 L-17 -10 L0 -26 L17 -10 L17 7 Z'
// The lit slope of its roof.
export const HOUSE_ROOF = 'M-17 -10 L0 -26 L0 -18 L-13 -6.5 Z'

// A peg standing on its foot.
export const ADVISOR_PATH = 'M-8 8 L-8 -14 A8 3.5 0 0 1 8 -14 L8 8 A8 3.5 0 0 1 -8 8 Z'
export const ADVISOR_TOP = 'M-8 -14 A8 3.5 0 0 1 8 -14 A8 3.5 0 0 1 -8 -14 Z'

// Where each of a country's advisors stands on its coat of arms: rows of up to four, centred.
export function advisorSpots(count: number): { x: number; y: number }[] {
    const rows = Math.ceil(count / 4)
    const spots: { x: number; y: number }[] = []
    for (let row = 0; row < rows; row++) {
        const inRow = Math.min(4, count - row * 4)
        for (let index = 0; index < inRow; index++) {
            spots.push({ x: (index - (inRow - 1) / 2) * 18, y: (row - (rows - 1) / 2) * 27 + 3 })
        }
    }
    return spots
}
