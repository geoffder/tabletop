// A stone temple of cut blocks, lit pixel by pixel by marching rays against rounded boxes.
// Only scripts/render-looks.mjs runs this, through the /looks page; rerun it after changing the
// temple or its stone.
import type { Level } from '@tabletop/mexica'
import {
    add,
    type Bitmap,
    clamp,
    dot,
    fractal,
    linear,
    noise2,
    mix,
    normalize,
    type Rgb,
    scale,
    type Vec
} from './light.js'
import { seededRandom } from './random.js'
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

const BLOCK = { shortest: 9, longest: 17, slabRow: 6.5, joint: 0.42, round: 0.7 }

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

const mottle = fractal(noise2(97), 4)
const pits = fractal(noise2(113), 3)
const wander = noise2(127)
const chips = noise2(131)

// Where the blocks of one course start, from the left: lengths drawn from its own seed.
function blockStarts(seed: number): number[] {
    const next = seededRandom(seed)
    const starts = [-40 - next() * BLOCK.longest]
    while (starts[starts.length - 1] < 40) {
        const length = BLOCK.shortest + next() * (BLOCK.longest - BLOCK.shortest)
        starts.push(starts[starts.length - 1] + length)
    }
    return starts
}

const COURSES = new Map<number, number[]>()

function courseStarts(seed: number): number[] {
    let starts = COURSES.get(seed)
    if (starts === undefined) {
        starts = blockStarts(seed)
        COURSES.set(seed, starts)
    }
    return starts
}

type Cut = { tip: Vec; joint: number; tone: number; hue: number }

// Cut stone in courses of blocks of uneven length: each block's face sits at a slight tilt of
// its own, is pitted and mottled, has a warmer or cooler cast, and wears unevenly into the
// joints round it. The stair is smooth stone, so its steps read.
function stoneAt(p: Vec, normal: Vec, shape: Shape): Cut {
    const onTop = normal[2] > 0.7
    const sideways = Math.abs(normal[0]) > 0.7
    if (shape.tier < 0 || (!onTop && !sideways && Math.abs(normal[1]) <= 0.7)) {
        const tone = shape.tone + (mottle(p[0] * 0.3, p[2] * 0.3) - 0.5) * 0.25
        return { tip: [0, 0, 0], joint: 0, tone, hue: 0 }
    }
    const block = shape.block
    const uAxis: Vec = sideways ? [0, 1, 0] : [1, 0, 0]
    const vAxis: Vec = onTop ? [0, 1, 0] : [0, 0, 1]
    const u = dot(p, uAxis)
    const v = onTop ? p[1] - block.y0 : p[2] - block.z0
    const courseHeight = onTop ? BLOCK.slabRow : block.z1 - block.z0
    const course = Math.floor(v / courseHeight)
    const seed = (shape.tier + 3) * 7919 + course * 131 + (onTop ? 17 : sideways ? 29 : 0)
    const starts = courseStarts(seed)
    let index = 0
    while (starts[index + 1] <= u) index++
    const fu = u - starts[index]
    const length = starts[index + 1] - starts[index]
    const fv = v - course * courseHeight
    const draw = seededRandom(seed * 31 + index * 7 + 1)
    const [r1, r2, r3, r4, r5] = [draw(), draw(), draw(), draw(), draw()]
    const jitter = (wander(u * 0.35 + seed, v * 0.35) - 0.5) * 0.6
    const edges = [fu, length - fu, fv, courseHeight - fv].map((edge) => edge + jitter)
    const toEdge = Math.min(...edges)
    const out = [scale(uAxis, -1), uAxis, scale(vAxis, -1), vAxis][edges.indexOf(toEdge)]
    const chipped = chips(u * 0.3, v * 0.3 + seed) > 0.72 ? 1.8 : 1
    const wear = BLOCK.round * (0.6 + r3 * 0.9) * chipped
    const roll = toEdge < wear ? (1 - toEdge / wear) ** 2 * 0.85 : 0
    const joint = clamp(1 - (toEdge - BLOCK.joint / 2) / 0.15)
    const pit = (du: number, dv: number) => pits(u * 0.9 + du, v * 0.9 + seed + dv)
    const pitU = (pit(0.4, 0) - pit(-0.4, 0)) * 1.4
    const pitV = (pit(0, 0.4) - pit(0, -0.4)) * 1.4
    const tilt = add(scale(uAxis, (r1 - 0.5) * 0.16 + pitU), scale(vAxis, (r2 - 0.5) * 0.16 + pitV))
    const tone = 0.08 + r4 * 0.5 + (mottle(u * 0.25, v * 0.25 + seed) - 0.5) * 0.5
    return { tip: add(tilt, scale(out, roll)), joint: joint * 0.9, tone, hue: (r5 - 0.5) * 0.7 }
}
