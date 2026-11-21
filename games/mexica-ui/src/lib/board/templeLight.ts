// A stone temple of cut blocks, lit pixel by pixel by marching rays against rounded boxes.
// Only scripts/render-looks.mjs runs this, through the /looks page; rerun it after changing the
// temple or its stone.
import type { Level } from '@tabletop/mexica'
import {
    add,
    type Bitmap,
    clamp,
    dot,
    linear,
    mix,
    normalize,
    type Rgb,
    scale,
    type Vec
} from './light.js'
import { type Coursing, type Cut, cutStone, smoothStone } from './cutStone.js'
import {
    type Block,
    DESIGN,
    doorwayBlocks,
    peakOf,
    pipCentres,
    shrineBlocks,
    stairParts,
    TEMPLE,
    type TempleDesign,
    templeBounds,
    tierBlocks
} from './templeShape.js'
import {
    castRays,
    LIGHT,
    normalAt,
    occlusion,
    roundedBox,
    type Scene,
    softShadow
} from './raymarch.js'

export const TEMPLE_PIXELS = 3

const COURSING: Coursing = { shortest: 9, longest: 17, row: 6.5, joint: 0.42, round: 0.7 }

export type TempleStone = { light: string; dark: string; joint: string; warm: string; cool: string }

export const TEMPLE_STONE: TempleStone = {
    light: '#e4e2db',
    dark: '#a19e95',
    joint: '#5f5c55',
    warm: '#d6c9b0',
    cool: '#bfc3c4'
}

// Stair stone has no blocks: `tone` is its shade between light and dark, and `riser` dims the
// faces of its steps towards the viewer.
type Shape = { block: Block; round: number; tier: number; tone: number; riser: number }
type Stone = { light: Rgb; dark: Rgb; joint: Rgb; warm: Rgb; cool: Rgb }
// Hollows cut out of the stone: shrine doorways and the pips on the top.
type Hollow = (p: Vec) => number

export function renderTemple(
    level: Level,
    tilt: number,
    design: TempleDesign = DESIGN,
    stone = TEMPLE_STONE,
    pixels = TEMPLE_PIXELS
): Bitmap {
    const box = templeBounds(level, tilt, design)
    const stair = stairParts(level, design)
    const heavy = design.stair.balustrade
    const shaped = (block: Block, round: number, tier: number) => ({
        block,
        round,
        tier,
        tone: 0.3,
        riser: 1
    })
    const shapes: Shape[] = [
        ...tierBlocks(level, design).map((block, tier) => shaped(block, TEMPLE.round, tier)),
        ...stair.steps.map((block) => ({
            ...shaped(block, TEMPLE.stairRound, -1),
            tone: heavy ? 0.12 : 0.3,
            riser: design.stair.riser
        })),
        ...stair.walls.map((block) => ({
            ...shaped(block, TEMPLE.stairRound, -1),
            tone: heavy ? 0.7 : 0.3
        })),
        ...shrineBlocks(level, design).map((block, index) => shaped(block, 0.6, level + index))
    ]
    const doorways = doorwayBlocks(level, design)
    const peak = peakOf(level, design)
    const pips = design.pips === 'carved' ? pipCentres(level, design) : []
    const hollow: Hollow = (p) =>
        Math.min(
            ...doorways.map((block) => roundedBox(p, block, 0.3)),
            ...pips.map(
                (pip) =>
                    Math.hypot(
                        p[0] - pip.x,
                        p[1] - pip.y,
                        p[2] - (peak + pip.radius - TEMPLE.pip.depth)
                    ) - pip.radius
            ),
            Infinity
        )
    const colors: Stone = {
        light: linear(stone.light),
        dark: linear(stone.dark),
        joint: linear(stone.joint),
        warm: linear(stone.warm),
        cool: linear(stone.cool)
    }
    const scene: Scene = (p) => Math.max(nearest(p, shapes).distance, -hollow(p))
    return castRays(box, tilt, pixels, scene, (p) => [
        { color: shade(p, shapes, scene, hollow, colors), alpha: 1 }
    ]).bitmaps[0]
}

function nearest(p: Vec, shapes: readonly Shape[]): { distance: number; shape: Shape } {
    let shape = shapes[0]
    let distance = Infinity
    for (const candidate of shapes) {
        const d = roundedBox(p, candidate.block, candidate.round)
        if (d < distance) {
            distance = d
            shape = candidate
        }
    }
    return { distance, shape }
}

function shade(p: Vec, shapes: readonly Shape[], scene: Scene, hollow: Hollow, stone: Stone): Rgb {
    const surface = normalAt(p, scene)
    const shape = nearest(p, shapes).shape
    const cut = stoneAt(p, surface, shape)
    const normal = normalize(add(surface, cut.tip))
    const body = mix(stone.light, stone.dark, clamp(cut.tone))
    const cast = mix(body, cut.hue > 0 ? stone.warm : stone.cool, Math.abs(cut.hue))
    const base = mix(cast, stone.joint, cut.joint)
    const sun = clamp(dot(normal, LIGHT)) * (0.35 + 0.65 * softShadow(p, surface, scene))
    const sky = 0.12 * Math.max(0, normal[1]) + 0.1 * Math.max(0, normal[2])
    const inside = hollow(p) < 0.25 ? 0.4 : 1
    const riser = surface[1] > 0.7 ? shape.riser : 1
    return scale(base, (0.4 + 0.6 * sun + sky) * occlusion(p, surface, scene) * inside * riser)
}

// The temple's tiers in cut stone; the stair is smooth stone, so its steps read.
function stoneAt(p: Vec, normal: Vec, shape: Shape): Cut {
    if (shape.tier < 0) return smoothStone(p, shape.tone)
    return cutStone(p, normal, shape.block, shape.tier, COURSING) ?? smoothStone(p, shape.tone)
}
