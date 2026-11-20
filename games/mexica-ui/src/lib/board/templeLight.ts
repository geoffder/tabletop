// A stone temple of brick courses, lit pixel by pixel by marching rays against rounded boxes.
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
    srgb,
    type Vec
} from './light.js'
import { seededRandom } from './random.js'
import { type Block, riseOf, stairBlocks, TEMPLE, templeBounds, tierBlocks } from './templeShape.js'

export const TEMPLE_PIXELS = 3

// From above, to the left and beyond the board, as the paving's light.
const LIGHT: Vec = normalize([-0.5, -0.45, 0.74])
const SUPERSAMPLE = 3
const HIT = 0.004
const FAR = 160

const BRICK = { length: 8.3, joint: 0.34, round: 0.6 }

export type TempleStone = { light: string; dark: string; joint: string }

export const TEMPLE_STONE: TempleStone = { light: '#e2e1dc', dark: '#aeaca5', joint: '#8b8981' }

type Shape = { block: Block; round: number; tier: number }
type Stone = { light: Rgb; dark: Rgb; joint: Rgb }
type Scene = (p: Vec) => number

export function renderTemple(
    level: Level,
    tilt: number,
    stone = TEMPLE_STONE,
    pixels = TEMPLE_PIXELS
): Bitmap {
    const box = templeBounds(level, tilt)
    const rise = riseOf(tilt)
    const shapes: Shape[] = [
        ...tierBlocks(level).map((block, tier) => ({ block, round: TEMPLE.round, tier })),
        ...stairBlocks(level).map((block) => ({ block, round: TEMPLE.stairRound, tier: -1 }))
    ]
    const colors: Stone = {
        light: linear(stone.light),
        dark: linear(stone.dark),
        joint: linear(stone.joint)
    }
    const toward: Vec = [0, rise, tilt]
    const scene: Scene = (p) => nearest(p, shapes).distance
    const width = Math.ceil(box.width * pixels)
    const height = Math.ceil(box.height * pixels)
    const data = new Uint8ClampedArray(width * height * 4)
    for (let row = 0; row < height; row++) {
        for (let column = 0; column < width; column++) {
            let sum: Rgb = [0, 0, 0]
            let cover = 0
            for (let sy = 0; sy < SUPERSAMPLE; sy++) {
                for (let sx = 0; sx < SUPERSAMPLE; sx++) {
                    const px = box.x + (column + (sx + 0.5) / SUPERSAMPLE) / pixels
                    const py = box.y + (row + (sy + 0.5) / SUPERSAMPLE) / pixels
                    // The pixel's ray meets the ground at (px, py / tilt, 0) and runs along
                    // `toward`; start well in front of the temple and march back.
                    const start = add([px, py / tilt, 0], scale(toward, FAR / 2))
                    const point = march(start, scale(toward, -1), scene)
                    if (point === undefined) continue
                    sum = add(sum, shade(point, shapes, scene, colors))
                    cover++
                }
            }
            if (cover === 0) continue
            const at = (row * width + column) * 4
            const color = scale(sum, 1 / cover)
            data[at] = srgb(color[0]) * 255
            data[at + 1] = srgb(color[1]) * 255
            data[at + 2] = srgb(color[2]) * 255
            data[at + 3] = (cover / SUPERSAMPLE ** 2) * 255
        }
    }
    return { x: box.x, y: box.y, width, height, data }
}

function roundedBox(p: Vec, block: Block, round: number): number {
    const qx = Math.abs(p[0] - (block.x0 + block.x1) / 2) - ((block.x1 - block.x0) / 2 - round)
    const qy = Math.abs(p[1] - (block.y0 + block.y1) / 2) - ((block.y1 - block.y0) / 2 - round)
    const qz = Math.abs(p[2] - (block.z0 + block.z1) / 2) - ((block.z1 - block.z0) / 2 - round)
    const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0))
    return outside + Math.min(Math.max(qx, qy, qz), 0) - round
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

function march(from: Vec, direction: Vec, scene: Scene): Vec | undefined {
    let travelled = 0
    for (let step = 0; step < 200 && travelled < FAR; step++) {
        const p = add(from, scale(direction, travelled))
        if (p[2] < -0.01) return undefined
        const d = scene(p)
        if (d < HIT) return p
        travelled += d
    }
    return undefined
}

function normalAt(p: Vec, scene: Scene): Vec {
    const e = 0.01
    return normalize([
        scene([p[0] + e, p[1], p[2]]) - scene([p[0] - e, p[1], p[2]]),
        scene([p[0], p[1] + e, p[2]]) - scene([p[0], p[1] - e, p[2]]),
        scene([p[0], p[1], p[2] + e]) - scene([p[0], p[1], p[2] - e])
    ])
}

function occlusion(p: Vec, normal: Vec, scene: Scene): number {
    let shade = 0
    let weight = 1
    for (let step = 1; step <= 5; step++) {
        const reach = step * 0.9
        shade += weight * (reach - scene(add(p, scale(normal, reach))))
        weight *= 0.55
    }
    return clamp(1 - shade * 0.2)
}

function softShadow(p: Vec, normal: Vec, scene: Scene): number {
    let light = 1
    let travelled = 0.15
    const from = add(p, scale(normal, 0.05))
    for (let step = 0; step < 48 && travelled < 60; step++) {
        const d = scene(add(from, scale(LIGHT, travelled)))
        if (d < 0.001) return 0
        light = Math.min(light, (6 * d) / travelled)
        travelled += Math.max(d, 0.08)
    }
    return clamp(light)
}

function shade(p: Vec, shapes: readonly Shape[], scene: Scene, stone: Stone): Rgb {
    const surface = normalAt(p, scene)
    const brick = brickAt(p, surface, nearest(p, shapes).shape)
    const normal = normalize(add(surface, brick.tip))
    const base = mix(
        mix(stone.light, stone.dark, 0.25 + brick.tone * 0.3),
        stone.joint,
        brick.joint
    )
    const sun = clamp(dot(normal, LIGHT)) * (0.35 + 0.65 * softShadow(p, surface, scene))
    const sky = 0.12 * Math.max(0, normal[1]) + 0.1 * Math.max(0, normal[2])
    return scale(base, (0.4 + 0.6 * sun + sky) * occlusion(p, surface, scene))
}

// Bricks in courses round each tier, every other course set over by half a brick; on tops they
// run left to right. Within `round` of a brick's edge its face rolls into the joint.
function brickAt(p: Vec, normal: Vec, shape: Shape): { tip: Vec; joint: number; tone: number } {
    const onTop = normal[2] > 0.7
    const sideways = Math.abs(normal[0]) > 0.7
    if (shape.tier < 0 || (!onTop && !sideways && Math.abs(normal[1]) <= 0.7))
        return { tip: [0, 0, 0], joint: 0, tone: 0.5 }
    const block = shape.block
    const courseHeight = TEMPLE.tier / 2
    const uAxis: Vec = sideways ? [0, 1, 0] : [1, 0, 0]
    const vAxis: Vec = onTop ? [0, 1, 0] : [0, 0, 1]
    const u = dot(p, uAxis) + 100
    const v = onTop ? p[1] - block.y0 : p[2] - block.z0
    const rowHeight = courseHeight
    const row = Math.floor(v / rowHeight)
    const shifted = u + (row % 2 === 0 ? 0 : BRICK.length / 2)
    const column = Math.floor(shifted / BRICK.length)
    const fu = shifted - column * BRICK.length
    const fv = v - row * rowHeight
    const edges = [fu, BRICK.length - fu, fv, rowHeight - fv]
    const toEdge = Math.min(...edges)
    const out = [scale(uAxis, -1), uAxis, scale(vAxis, -1), vAxis][edges.indexOf(toEdge)]
    const roll = toEdge < BRICK.round ? (1 - toEdge / BRICK.round) ** 2 * 0.8 : 0
    const joint = clamp(1 - (toEdge - BRICK.joint / 2) / 0.12)
    const tone = seededRandom((shape.tier + 3) * 7919 + row * 131 + column * 17 + (onTop ? 5 : 0))()
    return { tip: scale(out, roll), joint: joint * 0.85, tone }
}
