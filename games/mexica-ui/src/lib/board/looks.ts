export const PAVING_LOOK = 'paving'
export const LAKE_LOOK = 'lake'
export const CANAL_LOOK = 'canal'
export const SHORE_LOOK = 'shore'

export function templeLook(level: number, flat: boolean): string {
    return `temple-${level}${flat ? '-flat' : ''}`
}

// A canal's sloping bank, as wide as this in plan, a whole number of times into a cell so its
// bricks line up from cell to cell.
export const SLOPE_WIDTH = 8

export type SlopeSide = 'n' | 'e' | 's' | 'w'
export type SlopeCorner = 'ne' | 'nw' | 'se' | 'sw'

export function slopeLook(side: SlopeSide): string {
    return `slope-${side}`
}

export function slopeCornerLook(corner: SlopeCorner): string {
    return `slope-corner-${corner}`
}

export function spillLook(
    out: SlopeSide,
    end: SlopeSide,
    kind: 'across' | 'along',
    variant: number
): string {
    return `spill-${out}-${end}-${kind}-${variant}`
}
