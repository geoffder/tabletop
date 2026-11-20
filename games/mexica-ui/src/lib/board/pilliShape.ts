import { linear } from './light.js'
import { riseOf } from './templeShape.js'
import { type Box, PILLI_SIZE } from './view.js'

// A Pilli Mexica as a painted wooden figure, feet at the origin: x to the right, y towards the
// viewer, z up, in board units at full size: a noble in a robe flaring like a pawn's to a ring at
// the foot, studs round the hem between raised lines, the cloak's opening down the front, a
// cord along the cape's edge, a head of turned wood in a gold circlet set with turquoise, and
// two rows of feathers behind.
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
