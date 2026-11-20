import { riseOf } from './templeShape.js'
import type { Box } from './view.js'

// A Pilli Mexica as a painted wooden figure, feet at the origin: x to the right, y towards the
// viewer, z up, in board units.
//   fan: a cloaked noble with a bare wooden face and a fan of feathers behind the head.
//   crown: the same noble in a ring of feathers.
//   cutout: a flat figure with rounded edges, a plume on its head.
export type PilliDesign = 'fan' | 'crown' | 'cutout'

export const PILLI_DESIGNS: readonly PilliDesign[] = ['fan', 'crown', 'cutout']

export const PILLI_DESIGN: PilliDesign = 'fan'

export const PILLI_PIXELS = 3

// What each design takes up: half its width and depth, and its height.
const EXTENT: Record<PilliDesign, { half: number; depth: number; height: number }> = {
    fan: { half: 9.5, depth: 9.5, height: 31.5 },
    crown: { half: 9.5, depth: 9.5, height: 30 },
    cutout: { half: 13.5, depth: 4.5, height: 31.5 }
}

export function pilliBounds(tilt: number, design: PilliDesign = PILLI_DESIGN): Box {
    const { half, depth, height } = EXTENT[design]
    const margin = 1
    const top = -depth * tilt - height * riseOf(tilt)
    return {
        x: -half - margin,
        y: top - margin,
        width: 2 * (half + margin),
        height: depth * tilt - top + 2 * margin
    }
}

export function pilliLook(flat: boolean, design: PilliDesign = PILLI_DESIGN): string {
    return `pilli-${design}${flat ? '-flat' : ''}`
}
