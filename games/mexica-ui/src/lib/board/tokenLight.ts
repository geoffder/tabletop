// A calpulli token of gold, lit pixel by pixel by marching rays against an octagonal slab, a
// sun ring of turquoise raised on its face.
// Only scripts/render-looks.mjs runs this, through the /looks page; rerun it after changing the
// token.
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
import { castRays, LIGHT, normalAt, occlusion, type Scene, softShadow } from './raymarch.js'
import { TOKEN, tokenBounds } from './tokenShape.js'

export const TOKEN_PIXELS = 3

const APOTHEM = TOKEN.radius * Math.cos(Math.PI / 8)

// Inigo Quilez's regular octagon, `r` from its centre to the middle of a side.
function octagon(x: number, y: number, r: number): number {
    const k: [number, number, number] = [-0.9238795325, 0.3826834323, 0.4142135623]
    let px = Math.abs(x)
    let py = Math.abs(y)
    let d = 2 * Math.min(k[0] * px + k[1] * py, 0)
    px -= d * k[0]
    py -= d * k[1]
    d = 2 * Math.min(-k[0] * px + k[1] * py, 0)
    px -= d * -k[0]
    py -= d * k[1]
    px -= clamp(px, -k[2] * r, k[2] * r)
    py -= r
    return Math.hypot(px, py) * Math.sign(py)
}

// An octagon `r` across to its sides, from z0 to z1, its edges rounded.
function slab(p: Vec, r: number, z0: number, z1: number, round: number): number {
    const across = octagon(p[0], p[1], r - round)
    const up = Math.abs(p[2] - (z0 + z1) / 2) - ((z1 - z0) / 2 - round)
    return (
        Math.hypot(Math.max(across, 0), Math.max(up, 0)) + Math.min(Math.max(across, up), 0) - round
    )
}

const FACE_Z = TOKEN.height - TOKEN.sink
const FACE_APOTHEM = APOTHEM - TOKEN.rim

const token: Scene = (p) =>
    Math.max(
        slab(p, APOTHEM, 0, TOKEN.height, TOKEN.round),
        -slab(p, APOTHEM - TOKEN.rim, FACE_Z, TOKEN.height + 2, 0.5)
    )

// The sun ring, after the rings of the Sun Stone: an octagon `ring` in from the face's edge, a
// ray from it to each corner and a dot at the middle of each side, standing `height` proud of
// the face. Kept out by the rim, clear of the numbers.
const RING = {
    ring: 2.7,
    width: 0.4,
    ray: 0.6,
    dot: 0.65,
    dotInset: 1.35,
    height: 0.4,
    round: 0.25
}

// How far the point lies outside the ring's outline; below zero inside it. Measured in the frame
// of the face's nearest side: `inset` from its edge, `along` it from its middle.
function sunRing(x: number, y: number): number {
    const normal = (Math.round(Math.atan2(y, x) / (Math.PI / 4)) * Math.PI) / 4
    const inset = FACE_APOTHEM - (x * Math.cos(normal) + y * Math.sin(normal))
    const along = -x * Math.sin(normal) + y * Math.cos(normal)
    const half = (FACE_APOTHEM - inset) * Math.tan(Math.PI / 8)
    const ring = Math.abs(inset - RING.ring) - RING.width / 2
    const toCorner = half - Math.abs(along)
    const ray = Math.max(inset - RING.ring, (toCorner - inset * RING.ray) / Math.hypot(1, RING.ray))
    const dot = Math.hypot(along, inset - RING.dotInset) - RING.dot
    return Math.min(ring, ray, dot)
}

function sunRingSolid(p: Vec): number {
    const across = sunRing(p[0], p[1]) + RING.round
    const up = Math.abs(p[2] - FACE_Z) - (RING.height - RING.round)
    return (
        Math.hypot(Math.max(across, 0), Math.max(up, 0)) +
        Math.min(Math.max(across, up), 0) -
        RING.round
    )
}

const scene: Scene = (p) => Math.min(token(p), sunRingSolid(p))

// Brass-gold, a little worn.
const GOLD = {
    light: linear('#e8c063'),
    dark: linear('#8a5d22'),
    wear: linear('#a8772d'),
    shine: 0.35,
    mottle: 0.15
}

// Matte turquoise, flecked.
const TURQUOISE = { color: linear('#1f9c98'), fleck: 0.5, shine: 0.12 }

// The dark line round the token's outline, in board units, that keeps its edge from running
// into a yellow temple beside it.
const OUTLINE = { color: '#3b2708', width: 1.1 }

const mottle = fractal(noise2(181), 4)
const veins = fractal(noise2(191), 3)

// A dark line `width` in board units round the bitmap's outline, under it.
function outlined(bitmap: Bitmap, color: string, width: number, pixels: number): Bitmap {
    const { width: w, height: h, data } = bitmap
    const [r, g, b] = [1, 3, 5].map((at) => parseInt(color.slice(at, at + 2), 16))
    const reach = width * pixels
    const span = Math.ceil(reach)
    const out = new Uint8ClampedArray(data)
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let near = 0
            for (let dy = -span; dy <= span; dy++) {
                for (let dx = -span; dx <= span; dx++) {
                    const fall = clamp(reach + 0.5 - Math.hypot(dx, dy))
                    const xx = x + dx
                    const yy = y + dy
                    if (fall === 0 || xx < 0 || yy < 0 || xx >= w || yy >= h) continue
                    near = Math.max(near, (data[(yy * w + xx) * 4 + 3] / 255) * fall)
                }
            }
            const at = (y * w + x) * 4
            const top = data[at + 3] / 255
            const alpha = top + near * (1 - top)
            if (alpha === 0) continue
            const under = near * (1 - top)
            out[at] = (data[at] * top + r * under) / alpha
            out[at + 1] = (data[at + 1] * top + g * under) / alpha
            out[at + 2] = (data[at + 2] * top + b * under) / alpha
            out[at + 3] = alpha * 255
        }
    }
    return { ...bitmap, data: out }
}

export function renderToken(tilt: number, pixels = TOKEN_PIXELS): Bitmap {
    const toward: Vec = [0, Math.sqrt(1 - tilt * tilt), tilt]
    const bitmap = castRays(tokenBounds(tilt), tilt, pixels, scene, (p) => {
        const normal = normalAt(p, scene)
        let base: Rgb
        let shine: number
        if (sunRingSolid(p) < 0.05 && p[2] > FACE_Z - 0.02) {
            const fleck = (mottle(p[0] * 0.9 + 7, p[1] * 0.9) - 0.5) * TURQUOISE.fleck
            base = scale(TURQUOISE.color, 1 + fleck)
            shine = TURQUOISE.shine
        } else {
            const tone = 0.35 + (mottle(p[0] * 0.18, p[1] * 0.18) - 0.5) * GOLD.mottle * 2
            base = mix(GOLD.light, GOLD.dark, clamp(tone))
            // Faint lines of wear.
            const vein = 1 - Math.abs(veins(p[0] * 0.12 + 3, p[1] * 0.12) - 0.5) * 2
            base = mix(base, GOLD.wear, clamp((vein - 0.86) / 0.14) * 0.15)
            shine = GOLD.shine
        }
        const sun = clamp(dot(normal, LIGHT)) * (0.35 + 0.65 * softShadow(p, normal, scene))
        const sky = 0.12 * Math.max(0, normal[1]) + 0.1 * Math.max(0, normal[2])
        const lit = scale(base, (0.4 + 0.6 * sun + sky) * occlusion(p, normal, scene))
        const half = normalize(add(LIGHT, toward))
        const glint = shine * clamp(dot(normal, half)) ** 20
        return [{ color: add(lit, [glint, glint * 0.92, glint * 0.75]), alpha: 1 }]
    }).bitmaps[0]
    return outlined(bitmap, OUTLINE.color, OUTLINE.width, pixels)
}
