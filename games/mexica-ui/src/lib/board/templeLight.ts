// A stone temple lit pixel by pixel. Only scripts/render-looks.mjs runs this, through the /looks
// page; rerun it after changing the temple or its stone.
import type { Level } from '@tabletop/mexica'
import {
    add,
    type Bitmap,
    clamp,
    dot,
    fractal,
    linear,
    mix,
    noise2,
    normalize,
    type Rgb,
    scale,
    srgb,
    type Vec
} from './light.js'
import { type Block, riseOf, stairBlocks, templeBounds, tierBlocks } from './templeShape.js'

export const TEMPLE_PIXELS = 3

// From above, to the left and beyond the board, as the paving's light.
const LIGHT: Vec = normalize([-0.5, -0.45, 0.74])
const SUPERSAMPLE = 3
const BEVEL = 0.9
const JOINT = 0.32
const COURSE = 6.2

export type TempleStone = { light: string; dark: string; joint: string }

export const TEMPLE_STONE: TempleStone = { light: '#e2e1dc', dark: '#aeaca5', joint: '#76746d' }

type Hit = { block: Block; point: Vec; normal: Vec; stair: boolean }

export function renderTemple(
    level: Level,
    tilt: number,
    stone = TEMPLE_STONE,
    pixels = TEMPLE_PIXELS
): Bitmap {
    const box = templeBounds(level, tilt)
    const rise = riseOf(tilt)
    const tiers = tierBlocks(level)
    const stairs = stairBlocks(level)
    const blocks = [
        ...tiers.map((block) => ({ block, stair: false })),
        ...stairs.map((block) => ({ block, stair: true }))
    ]
    const [light, dark, joint] = [stone.light, stone.dark, stone.joint].map(linear)
    const grain = fractal(noise2(71), 4)
    const speck = noise2(83)
    const width = Math.ceil(box.width * pixels)
    const height = Math.ceil(box.height * pixels)
    const data = new Uint8ClampedArray(width * height * 4)
    const shadeHit = (hit: Hit): Rgb => {
        const [x, y, z] = hit.point
        const onTop = hit.normal[2] > 0.5
        const lit = clamp(dot(hit.normal, LIGHT))
        const tone = (grain(x * 0.18 + (onTop ? 0 : 40), (onTop ? y : z) * 0.18) - 0.5) * 0.5
        let base = mix(light, dark, clamp(0.35 + tone))
        if (speck(x * 1.7, (onTop ? y : z) * 1.7) > 0.8) base = mix(base, dark, 0.35)
        if (!onTop && !hit.stair && isJoint(x, z, hit.block)) base = mix(base, joint, 0.75)
        const occlusion = occlusionAt(hit, tiers)
        const sky = Math.max(0, hit.normal[1]) * 0.14
        const value = (0.46 + 0.62 * lit + sky) * occlusion
        return scale(base, value)
    }
    for (let row = 0; row < height; row++) {
        for (let column = 0; column < width; column++) {
            let sum: Rgb = [0, 0, 0]
            let cover = 0
            for (let sy = 0; sy < SUPERSAMPLE; sy++) {
                for (let sx = 0; sx < SUPERSAMPLE; sx++) {
                    const px = box.x + (column + (sx + 0.5) / SUPERSAMPLE) / pixels
                    const py = box.y + (row + (sy + 0.5) / SUPERSAMPLE) / pixels
                    const hit = castRay(px, py, tilt, rise, blocks)
                    if (hit === undefined) continue
                    sum = add(sum, shadeHit(hit))
                    cover++
                }
            }
            const at = (row * width + column) * 4
            if (cover === 0) continue
            const color = scale(sum, 1 / cover)
            data[at] = srgb(color[0]) * 255
            data[at + 1] = srgb(color[1]) * 255
            data[at + 2] = srgb(color[2]) * 255
            data[at + 3] = (cover / SUPERSAMPLE ** 2) * 255
        }
    }
    return { x: box.x, y: box.y, width, height, data }
}

// The ray towards the screen point (x, y × tilt − z × rise = sy) runs along (0, rise, tilt); the
// nearest hit is the farthest along it.
function castRay(
    sx: number,
    sy: number,
    tilt: number,
    rise: number,
    blocks: { block: Block; stair: boolean }[]
): Hit | undefined {
    const groundY = sy / tilt
    let best: Hit | undefined
    let bestS = -Infinity
    for (const { block, stair } of blocks) {
        if (sx < block.x0 || sx > block.x1) continue
        let low = block.z0 / tilt
        let high = block.z1 / tilt
        let entersFront = false
        if (rise > 0) {
            const fromY0 = (block.y0 - groundY) / rise
            const fromY1 = (block.y1 - groundY) / rise
            if (fromY1 < high) {
                high = fromY1
                entersFront = true
            }
            low = Math.max(low, fromY0)
        } else if (groundY < block.y0 || groundY > block.y1) {
            continue
        }
        if (low > high || high <= bestS) continue
        bestS = high
        const point: Vec = [sx, groundY + high * rise, high * tilt]
        best = { block, point, normal: bevelled(point, block, entersFront), stair }
    }
    return best
}

// A face's normal, turned towards the next face within BEVEL of an edge, so edges read rounded.
function bevelled(point: Vec, block: Block, front: boolean): Vec {
    const [x, y, z] = point
    const ease = (distance: number) => (distance < BEVEL ? (1 - distance / BEVEL) ** 2 * 0.7 : 0)
    let normal: Vec = front ? [0, 1, 0] : [0, 0, 1]
    normal = add(normal, scale([-1, 0, 0], ease(x - block.x0)))
    normal = add(normal, scale([1, 0, 0], ease(block.x1 - x)))
    if (front) {
        normal = add(normal, scale([0, 0, 1], ease(block.z1 - z)))
    } else {
        normal = add(normal, scale([0, 1, 0], ease(block.y1 - y)))
        normal = add(normal, scale([0, -1, 0], ease(y - block.y0)))
    }
    return normalize(normal)
}

// Courses of blocks across each tier's face, every other course's joints set half a block over.
function isJoint(x: number, z: number, block: Block): boolean {
    const courseHeight = (block.z1 - block.z0) / 2
    const course = Math.floor((z - block.z0) / courseHeight)
    const inCourse = z - block.z0 - course * courseHeight
    if (inCourse < JOINT * 0.5 || courseHeight - inCourse < JOINT * 0.5) return true
    const offset = course % 2 === 0 ? 0 : COURSE / 2
    const along = (((x + offset) % COURSE) + COURSE) % COURSE
    return along < JOINT
}

// Shade in the corner where a tier's top meets the face of the tier above, and at a face's foot.
function occlusionAt(hit: Hit, tiers: Block[]): number {
    const [x, y, z] = hit.point
    if (hit.normal[2] > 0.5) {
        const above = tiers.find((tier) => Math.abs(tier.z0 - z) < 0.01)
        if (above === undefined) return 1
        const toFace = Math.max(Math.abs(x), Math.abs(y)) - above.x1
        return toFace > 0 ? 1 - 0.4 * Math.exp(-toFace / 1.4) : 1
    }
    return 1 - 0.3 * Math.exp(-(z - hit.block.z0) / 1.1)
}
