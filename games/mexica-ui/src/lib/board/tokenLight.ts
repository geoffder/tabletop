// A calpulli token of gold, lit pixel by pixel by marching rays against an octagonal slab.
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

const scene: Scene = (p) =>
    Math.max(
        slab(p, APOTHEM, 0, TOKEN.height, TOKEN.round),
        -slab(p, APOTHEM - TOKEN.rim, TOKEN.height - TOKEN.sink, TOKEN.height + 2, 0.5)
    )

// Brass-gold, a little worn.
const GOLD = {
    light: linear('#e8c063'),
    dark: linear('#8a5d22'),
    wear: linear('#a8772d'),
    shine: 0.35,
    mottle: 0.15
}

const mottle = fractal(noise2(181), 4)
const veins = fractal(noise2(191), 3)

export function renderToken(tilt: number, pixels = TOKEN_PIXELS): Bitmap {
    const look = GOLD
    const toward: Vec = [0, Math.sqrt(1 - tilt * tilt), tilt]
    return castRays(tokenBounds(tilt), tilt, pixels, scene, (p) => {
        const normal = normalAt(p, scene)
        const tone = 0.35 + (mottle(p[0] * 0.18, p[1] * 0.18) - 0.5) * look.mottle * 2
        let base = mix(look.light, look.dark, clamp(tone))
        // Faint lines of wear.
        const vein = 1 - Math.abs(veins(p[0] * 0.12 + 3, p[1] * 0.12) - 0.5) * 2
        base = mix(base, look.wear, clamp((vein - 0.86) / 0.14) * 0.15)
        const sun = clamp(dot(normal, LIGHT)) * (0.35 + 0.65 * softShadow(p, normal, scene))
        const sky = 0.12 * Math.max(0, normal[1]) + 0.1 * Math.max(0, normal[2])
        const lit = scale(base, (0.4 + 0.6 * sun + sky) * occlusion(p, normal, scene))
        const half = normalize(add(LIGHT, toward))
        const glint = look.shine * clamp(dot(normal, half)) ** 20
        return [{ color: add(lit, [glint, glint * 0.92, glint * 0.75]), alpha: 1 }]
    }).bitmaps[0]
}
