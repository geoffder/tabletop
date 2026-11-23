export const PAVING_LOOK = 'paving'
export const LAKE_LOOK = 'lake'
export const CANAL_LOOK = 'canal'
export const SHORE_LOOK = 'shore'
// The sheet of patches for the coast at a pinch: see pinches.ts.
export const PINCH_LOOK = 'pinches'
// The action point's mask (routes/looks/MaskDrawing.svelte), in that drawing's units: the box
// holds all of it, strokes included, as its feathers reach a little past the icon's square.
export const MASK_LOOK = 'mask'
export const MASK_BOX = { x: -32, y: -31, width: 64, height: 54 }

export function bridgeLook(screenAxis: string, flat: boolean, layer = 'whole'): string {
    return `bridge-${screenAxis}${layer === 'whole' ? '' : `-${layer}`}${flat ? '-flat' : ''}`
}

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
    depth: number
): string {
    return `spill-${out}-${end}-${kind}-${depth}`
}

// How far an inside corner's cove rounds the bank's foot at the water: 0 leaves it square.
export const COVE_TOE = 8

export function slopeCoveLook(corner: SlopeCorner): string {
    return `slope-cove-${corner}`
}
