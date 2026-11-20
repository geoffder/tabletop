import { linear } from './light.js'
import { riseOf } from './templeShape.js'
import { type Box, PILLI_SIZE } from './view.js'

// A Pilli Mexica as a painted wooden figure, feet at the origin: x to the right, y towards the
// viewer, z up, in board units at full size. A cloaked noble with a bare wooden face and a fan
// of feathers behind the head.
//   robe: a bell, or a pawn's concave flare on a ring at the foot.
//   trim: raised lines round the hem, with triangles, a stepped fret or studs between them
//     (hem), the cloak's opening down the front and a cord along the
//     cape's edge.
//   knot: the cloak's corners tied over the right shoulder or at the chest, as the Mexica
//     fastened a cloak.
//   arms: forearms meeting in front, wooden hands clasped.
//   fan: a smooth fan, separate feathers, or a second, shorter row of feathers in front.
//   headband: a gold band round the head with a jewel at the front; a thinner circlet higher
//     on the brow with a medallion; the xiuhuitzolli, the pointed turquoise diadem of the
//     Mexica rulers; or the band with ear spools.
//   eyes: the fan painted in bands, a spot near each feather's tip.
export type PilliStyle = {
    robe: 'bell' | 'pawn'
    trim: boolean
    hem: 'lines' | 'triangles' | 'fret' | 'studs'
    knot: 'none' | 'shoulder' | 'chest'
    arms: boolean
    fan: 'plain' | 'feathers' | 'tiered'
    headband: 'none' | 'band' | 'circlet' | 'diadem' | 'spools'
    eyes: boolean
}

export const PILLI_STYLE: PilliStyle = {
    robe: 'pawn',
    trim: true,
    hem: 'studs',
    knot: 'none',
    arms: false,
    fan: 'tiered',
    headband: 'band',
    eyes: false
}

// How strongly the shine layer lies over the darkest paint.
export const PILLI_SHINE = 0.3

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

export function pilliShineLook(flat: boolean): string {
    return `pilli-shine${flat ? '-flat' : ''}`
}

// The shine over a paint colour: full over black, fading out by mid-tones.
export function shineOver(fill: string, strength = PILLI_SHINE): number {
    const [r, g, b] = linear(fill)
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
    return strength * Math.max(0, 1 - luminance / 0.4)
}
