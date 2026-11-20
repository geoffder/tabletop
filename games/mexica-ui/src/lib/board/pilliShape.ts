import { riseOf } from './templeShape.js'
import { type Box, PILLI_SIZE } from './view.js'

// A Pilli Mexica as a painted wooden figure, feet at the origin: x to the right, y towards the
// viewer, z up, in board units at full size. A cloaked noble with a bare wooden face and a fan
// of feathers behind the head.
//   robe: a bell, or a pawn's concave flare on a ring at the foot.
//   trim: a stepped fret round the hem, the cloak's opening down the front and a knot on the
//     shoulder.
//   arms: forearms meeting in front, wooden hands clasped.
//   fan: a smooth fan, separate feathers, or a second, shorter row of feathers in front.
//   headband: a gold band round the head with a jewel at the front.
//   eyes: the fan painted in bands, a spot near each feather's tip.
export type PilliStyle = {
    robe: 'bell' | 'pawn'
    trim: boolean
    arms: boolean
    fan: 'plain' | 'feathers' | 'tiered'
    headband: boolean
    eyes: boolean
}

export const PILLI_STYLE: PilliStyle = {
    robe: 'bell',
    trim: false,
    arms: false,
    fan: 'plain',
    headband: false,
    eyes: false
}

export const PILLI_PIXELS = 3

// What the figure takes up at full size: half its width and depth, and its height.
const EXTENT = { half: 9.6, depth: 9.5, height: 31.5 }

export function pilliBounds(tilt: number): Box {
    const half = EXTENT.half * PILLI_SIZE
    const depth = EXTENT.depth * PILLI_SIZE
    const height = EXTENT.height * PILLI_SIZE
    const margin = 1
    const top = -depth * tilt - height * riseOf(tilt)
    return {
        x: -half - margin,
        y: top - margin,
        width: 2 * (half + margin),
        height: depth * tilt - top + 2 * margin
    }
}

export function pilliLook(flat: boolean): string {
    return `pilli${flat ? '-flat' : ''}`
}
