// How a turn's pills fill the card: rows that read across then down, as even as they come. Three
// to a row while they fit at full size; past that, the count of columns, and the scale, that
// keeps them biggest within the card.

export const PREFERRED_COLUMNS = 3
const MOST_COLUMNS = 6

export type PillMeasures = {
    // Each pill's width at full size, in turn order.
    widths: readonly number[]
    pillHeight: number
    // The name above the pills, and the gap under it.
    headWidth: number
    headHeight: number
    headGap: number
    columnGap: number
    rowGap: number
}

export type PillFit = { columns: number; scale: number }

// The columns `count` pills take when a row holds at most `most`: four take two rows of two.
export function evenColumns(count: number, most: number): number {
    return Math.ceil(count / Math.max(1, Math.ceil(count / most)))
}

// The full-size width and height of the pills set out in `columns` columns.
export function pillBlock(
    measures: PillMeasures,
    columns: number
): { width: number; height: number } {
    const { widths, pillHeight, headWidth, headHeight, headGap, columnGap, rowGap } = measures
    const columnWidths = Array.from({ length: columns }, (_, column) =>
        Math.max(0, ...widths.filter((_, index) => index % columns === column))
    )
    const rows = Math.ceil(widths.length / columns)
    return {
        width: Math.max(
            headWidth,
            columnWidths.reduce((sum, width) => sum + width, 0) + columnGap * (columns - 1)
        ),
        height: headHeight + headGap + rows * pillHeight + (rows - 1) * rowGap
    }
}

export function fitPills(measures: PillMeasures, room: { width: number; height: number }): PillFit {
    const count = measures.widths.length
    if (count === 0) return { columns: 1, scale: 1 }
    const scaleFor = (columns: number) => {
        const block = pillBlock(measures, columns)
        return Math.min(1, room.width / block.width, room.height / block.height)
    }
    const preferred = evenColumns(count, PREFERRED_COLUMNS)
    let best: PillFit = { columns: preferred, scale: scaleFor(preferred) }
    if (best.scale >= 1) return best
    for (let most = PREFERRED_COLUMNS + 1; most <= MOST_COLUMNS; most++) {
        const columns = evenColumns(count, most)
        const scale = scaleFor(columns)
        if (scale > best.scale) best = { columns, scale }
    }
    return best
}
