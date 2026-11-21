// The Emperor's palace, lit pixel by pixel by marching rays against its blocks: dark slate-grey
// stone laid in blocks on its tops, plain stairs, and a bronze sun disc in the middle.
// Only scripts/render-looks.mjs runs this, through the /looks page; rerun it after changing the
// palace.
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
    type Vec
} from './light.js'
import { PALACE, PALACE_TOP, palaceBounds, palaceParts, type PalacePart } from './palaceShape.js'
import {
    castRays,
    LIGHT,
    normalAt,
    occlusion,
    roundedBox,
    type Scene,
    softShadow
} from './raymarch.js'

export const PALACE_PIXELS = 3

const STONE = { light: linear('#a1a6ad'), dark: linear('#646a73'), joint: linear('#3f434a') }
const BRONZE = { light: linear('#d0a65c'), dark: linear('#6b4b22') }
const BLOCK = { long: 7, short: 3.6, joint: 0.35 }

const mottle = fractal(noise2(201), 4)

// The sun disc's carving: rings and rays, 0 on its face and 1 deepest in a groove.
function carving(x: number, y: number): number {
    const r = Math.hypot(x, y)
    const groove = (at: number, width: number) => Math.exp(-(((r - at) / width) ** 2))
    const angle = Math.atan2(y, x)
    const rays = r > 4.5 && r < 8 ? Math.max(0, Math.cos(angle * 8)) ** 6 * 0.8 : 0
    return clamp(groove(9.6, 0.6) + groove(4, 0.6) * 0.8 + rays + groove(1.6, 0.5) * 0.6)
}

// Blocks laid in running courses on a top, darker in their joints.
function blockJoint(x: number, y: number): number {
    const course = Math.floor(y / BLOCK.short)
    const shift = course % 2 === 0 ? 0 : BLOCK.long / 2
    const u = (((x + shift) % BLOCK.long) + BLOCK.long) % BLOCK.long
    const v = y - course * BLOCK.short
    const edge = Math.min(u, BLOCK.long - u, v, BLOCK.short - v)
    return clamp(1 - (edge - BLOCK.joint / 2) / 0.2)
}

export function renderPalace(tilt: number, pixels = PALACE_PIXELS): Bitmap {
    const parts = palaceParts()
    const { radius, depth } = PALACE.emblem
    const disc = (p: Vec) =>
        Math.max(
            Math.hypot(p[0], p[1]) - radius,
            Math.abs(p[2] - (PALACE_TOP - depth / 2)) - depth / 2
        )
    const nearest = (p: Vec): { distance: number; part?: PalacePart } => {
        let distance = disc(p)
        let part: PalacePart | undefined
        for (const candidate of parts) {
            const d = roundedBox(p, candidate.block, candidate.round)
            if (d < distance) {
                distance = d
                part = candidate
            }
        }
        return { distance, part }
    }
    const scene: Scene = (p) => nearest(p).distance
    const toward: Vec = [0, Math.sqrt(1 - tilt * tilt), tilt]
    return castRays(palaceBounds(tilt), tilt, pixels, scene, (p) => {
        const normal = normalAt(p, scene)
        const { part } = nearest(p)
        const tone = 0.35 + (mottle(p[0] * 0.09, p[1] * 0.09 + p[2] * 0.09) - 0.5) * 0.5
        const sun = clamp(dot(normal, LIGHT)) * (0.35 + 0.65 * softShadow(p, normal, scene))
        const sky = 0.12 * Math.max(0, normal[1]) + 0.1 * Math.max(0, normal[2])
        const light = (0.4 + 0.6 * sun + sky) * occlusion(p, normal, scene)
        if (part === undefined) {
            // Bronze: its carving darker, its face catching the light.
            const cut = carving(p[0], p[1])
            const metal = mix(BRONZE.light, BRONZE.dark, clamp(0.25 + cut * 0.6 + tone * 0.3))
            const half = normalize(add(LIGHT, toward))
            const glint = 0.25 * (1 - cut) * clamp(dot(normal, half)) ** 16
            return [
                { color: add(scale(metal, light), [glint, glint * 0.9, glint * 0.7]), alpha: 1 }
            ]
        }
        let base: Rgb = mix(STONE.light, STONE.dark, clamp(tone))
        const onTop = normal[2] > 0.7
        if (onTop && part.material === 'stone') {
            // Courses run along each arm.
            const [along, across] = Math.abs(p[1]) < Math.abs(p[0]) ? [p[0], p[1]] : [p[1], p[0]]
            base = mix(base, STONE.joint, blockJoint(along, across) * 0.7)
        }
        // The stairs' treads a little paler than their risers.
        if (part.material === 'stair' && onTop) base = mix(base, STONE.light, 0.25)
        return [{ color: scale(base, light), alpha: 1 }]
    }).bitmaps[0]
}
