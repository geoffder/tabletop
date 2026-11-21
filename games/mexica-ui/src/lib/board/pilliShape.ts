import { linear } from './light.js'
import { riseOf } from './templeShape.js'
import { type Box, FLAT, PILLI_SIZE, PILLI_WIDTH } from './view.js'

// A Pilli Mexica as a painted wooden figure, feet at the origin: x to the right, y towards the
// viewer, z up, in board units at full size: a noble in a robe flaring like a pawn's to a ring at
// the foot, studs round the hem between raised lines, the cloak's opening down the front, a
// cord along the cape's edge, a mask after the one on the box over a painted hood, and two rows
// of feathers springing from the mask's frame.
// How strongly the shine layer lies over the darkest paint.
export const PILLI_SHINE = 0.3

export const PILLI_PIXELS = 3

// What the figure takes up as drawn: half its width and depth, and its height.
const EXTENT = { half: 9.6, depth: 9.5, height: 31.5 }
// The back row of feathers: half as wide, and how much higher its top reaches for each step
// the headdress is scaled up from its foot.
export const HEADDRESS = { half: 7.8, rise: 11.2 }

// The figure's height and width as multiples of it as drawn, and its headdress's scale.
export type PilliProportions = { height: number; width: number; headdress: number }
export const PILLI: PilliProportions = { height: PILLI_SIZE, width: PILLI_WIDTH, headdress: 1.2 }

// Seen from straight above, the figure is only its mask, lying face up with its feathers
// spreading above it on the board, `scale` times as big as worn and centred on its spot: the
// head's centre `lift` above the ground. `reach` is how far the feathers spread either side
// and above the face's middle, and `chin` how far the pendant hangs below it, as worn.
export const FACE_UP = { scale: 1.6, lift: 4.2, reach: 10.6, above: 9.8, chin: 4.8 }

export function pilliBounds(tilt: number, proportions = PILLI): Box {
    if (tilt === FLAT) {
        const by = FACE_UP.scale * proportions.width
        const margin = 1
        return {
            x: -FACE_UP.reach * by - margin,
            y: -FACE_UP.above * by - margin,
            width: 2 * (FACE_UP.reach * by + margin),
            height: (FACE_UP.above + FACE_UP.chin) * by + 2 * margin
        }
    }
    const half =
        Math.max(EXTENT.half, HEADDRESS.half * proportions.headdress + 1.5) * proportions.width
    const depth = EXTENT.depth * proportions.width
    const height =
        (EXTENT.height + HEADDRESS.rise * (proportions.headdress - 1)) * proportions.height
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
