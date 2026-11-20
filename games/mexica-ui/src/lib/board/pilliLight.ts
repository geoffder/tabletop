// A Pilli Mexica, lit pixel by pixel by marching rays against its distance field. The board
// fills the figure's outline with its owner's colour and lays this image over it: where the
// figure is painted, the image holds only the light, as black that darkens the paint and white
// that lights it; the bare wood shows as itself. So one image serves every player colour.
// Only scripts/render-looks.mjs runs this, through the /looks page; rerun it after changing the
// figure.
import {
    add,
    type Bitmap,
    clamp,
    dot,
    linear,
    mix,
    type Rgb,
    scale,
    srgb,
    type Vec
} from './light.js'
import { PILLI_DESIGN, PILLI_PIXELS, type PilliDesign, pilliBounds } from './pilliShape.js'
import { PILLI_SIZE } from './view.js'
import {
    castRays,
    LIGHT,
    normalAt,
    occlusion,
    outlineOf,
    type Sample,
    type Scene,
    softShadow
} from './raymarch.js'

const WOOD = { light: linear('#e2bf91'), dark: linear('#b98a5a') }
// The light on a painted face turned up towards it shows the paint as it is.
const FULL_LIGHT = 0.92
const GLOSS = { strength: 0.22, power: 24 }

// What a point of the figure is made of: paint, lightened (above 1) or darkened (below) by
// what is painted there, or bare wood.
type Finish = { wood: boolean; tone: number }
type Figure = { scene: Scene; finish: (p: Vec) => Finish }

export type PilliLook = { bitmap: Bitmap; outline: string }

export function renderPilli(
    tilt: number,
    design: PilliDesign = PILLI_DESIGN,
    pixels = PILLI_PIXELS
): PilliLook {
    const box = pilliBounds(tilt, design)
    const full = FIGURES[design]
    const figure: Figure = {
        scene: (p) => full.scene(scale(p, 1 / PILLI_SIZE)) * PILLI_SIZE,
        finish: (p) => full.finish(scale(p, 1 / PILLI_SIZE))
    }
    const toward: Vec = [0, Math.sqrt(1 - tilt * tilt), tilt]
    const { bitmap, hits } = castRays(
        box,
        tilt,
        pixels,
        figure.scene,
        (p) => shade(p, figure, toward),
        (channel) => clamp(channel)
    )
    return { bitmap, outline: outlineOf(hits, box, pixels) }
}

// In sRGB, as the page lays it over the paint.
function shade(p: Vec, figure: Figure, toward: Vec): Sample {
    const normal = normalAt(p, figure.scene)
    const sun = clamp(dot(normal, LIGHT)) * (0.3 + 0.7 * softShadow(p, normal, figure.scene))
    const sky = 0.14 * Math.max(0, normal[1]) + 0.12 * Math.max(0, normal[2])
    const light = (0.38 + 0.62 * sun + sky) * occlusion(p, normal, figure.scene)
    const finish = figure.finish(p)
    const bounce = add(scale(normal, 2 * dot(normal, LIGHT)), scale(LIGHT, -1))
    const gloss = GLOSS.strength * clamp(dot(bounce, toward)) ** GLOSS.power
    if (finish.wood) {
        const grain = mix(WOOD.dark, WOOD.light, 0.55 + 0.45 * Math.sin(p[2] * 2.1 + p[0] * 0.4))
        const lit = scale(grain, light * 1.05)
        return { color: [srgb(lit[0]), srgb(lit[1]), srgb(lit[2])], alpha: 1 }
    }
    // As a factor on the paint's sRGB colour; more than full light lightens it.
    const factor = ((light / FULL_LIGHT) * finish.tone) ** (1 / 2.2)
    const white = clamp(gloss + Math.max(0, factor - 1) * 0.6)
    const keep = Math.min(factor, 1) * (1 - white)
    const alpha = 1 - keep
    if (alpha <= 0) return { color: [0, 0, 0], alpha: 0 }
    const grey = white / alpha
    const color: Rgb = [grey, grey, grey]
    return { color, alpha }
}

type Flat = [number, number]

const length2 = (x: number, y: number) => Math.hypot(x, y)

// Smooth union: the two shapes meet in a fillet `k` wide.
function blend(a: number, b: number, k: number): number {
    const h = clamp(0.5 + (0.5 * (b - a)) / k)
    return b + (a - b) * h - k * h * (1 - h)
}

function sphere(p: Vec, centre: Vec, radius: number): number {
    return Math.hypot(p[0] - centre[0], p[1] - centre[1], p[2] - centre[2]) - radius
}

// Inigo Quilez's bound for an ellipsoid; close enough near its surface.
function ellipsoid(p: Vec, radii: Vec): number {
    const k0 = Math.hypot(p[0] / radii[0], p[1] / radii[1], p[2] / radii[2])
    const k1 = Math.hypot(
        p[0] / (radii[0] * radii[0]),
        p[1] / (radii[1] * radii[1]),
        p[2] / (radii[2] * radii[2])
    )
    return k1 === 0 ? -Math.min(...radii) : (k0 * (k0 - 1)) / k1
}

// Distance in the (radius, height) plane to a segment, turned round the z axis.
function lathe(q: Flat, a: Flat, b: Flat): number {
    const [dx, dy] = [b[0] - a[0], b[1] - a[1]]
    const t = clamp(((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / (dx * dx + dy * dy))
    return length2(q[0] - a[0] - dx * t, q[1] - a[1] - dy * t)
}

// A solid of revolution from z0 to z1, radius r0 at the foot and r1 at the top, its edges
// rounded by `round`: Inigo Quilez's capped cone.
function frustum(p: Vec, z0: number, z1: number, r0: number, r1: number, round: number): number {
    const h = (z1 - z0) / 2 - round
    const ra = r0 - round
    const rb = r1 - round
    const qx = length2(p[0], p[1])
    const qy = p[2] - (z0 + z1) / 2
    const [k2x, k2y] = [rb - ra, 2 * h]
    const ca: Flat = [qx - Math.min(qx, qy < 0 ? ra : rb), Math.abs(qy) - h]
    const t = clamp(((rb - qx) * k2x + (h - qy) * k2y) / (k2x * k2x + k2y * k2y))
    const cb: Flat = [qx - rb + k2x * t, qy - h + k2y * t]
    const sign = cb[0] < 0 && ca[1] < 0 ? -1 : 1
    const nearest = Math.min(ca[0] ** 2 + ca[1] ** 2, cb[0] ** 2 + cb[1] ** 2)
    return sign * Math.sqrt(nearest) - round
}

function segment(q: Flat, a: Flat, b: Flat): number {
    return lathe(q, a, b)
}

// The cloaked noble both headdresses share: a bell of a cloak, a cape over the shoulders and a
// wooden head.
const CLOAK = { foot: 8.6, neck: 4.6, height: 15.5, round: 1.3 }
const CAPE: Vec = [6.4, 4.6, 2.9]
const CAPE_AT = 15.6
const HEAD = { radius: 3.7, at: 21.2 }

function noble(p: Vec): number {
    const cloak = frustum(p, 0, CLOAK.height, CLOAK.foot, CLOAK.neck, CLOAK.round)
    const cape = ellipsoid([p[0], p[1], p[2] - CAPE_AT], CAPE)
    const head = sphere(p, [0, 0.3, HEAD.at], HEAD.radius)
    return Math.min(blend(cloak, cape, 1.6), head)
}

function nobleFinish(p: Vec): Finish {
    if (p[2] > CAPE_AT + 1.8 && sphere(p, [0, 0.3, HEAD.at], HEAD.radius) < 0.3) {
        return { wood: true, tone: 1 }
    }
    // A darker hem, and a lighter band where the cape's edge falls over the cloak.
    if (p[2] < 2.4) return { wood: false, tone: 0.72 }
    const capeEdge = Math.abs(p[2] - (CAPE_AT - CAPE[2] * 0.55))
    if (capeEdge < 0.7) return { wood: false, tone: 1.3 }
    return { wood: false, tone: 1 }
}

// The fan stands behind the head, leaning back, its rim cut into feather tips.
const FAN = { centre: [0, -3.4, 25] satisfies Vec, radii: [7.8, 0.9, 6.4] satisfies Vec }
const FAN_LEAN = 0.42
const FEATHERS = 9

function fanFrame(p: Vec): Vec {
    const [x, y, z] = [p[0] - FAN.centre[0], p[1] - FAN.centre[1], p[2] - FAN.centre[2]]
    const c = Math.cos(FAN_LEAN)
    const s = Math.sin(FAN_LEAN)
    return [x, y * c + z * s, -y * s + z * c]
}

function featherAngle(q: Vec): number {
    return Math.atan2(q[0], q[2] + FAN.radii[2] * 0.75)
}

function fan(p: Vec): number {
    const q = fanFrame(p)
    const tips = Math.abs(Math.sin((featherAngle(q) * FEATHERS) / 1.2)) * 0.7
    const radii: Vec = [FAN.radii[0] - tips, FAN.radii[1], FAN.radii[2] - tips]
    return ellipsoid(q, radii) * 0.8
}

function fanFinish(p: Vec): Finish {
    const q = fanFrame(p)
    const reach = Math.hypot(q[0] / FAN.radii[0], q[2] / FAN.radii[2])
    if (reach > 0.78) return { wood: false, tone: 1.45 }
    const stripe = Math.cos(featherAngle(q) * FEATHERS * 2.5)
    return { wood: false, tone: 1 + 0.1 * stripe }
}

// A ring of feathers rising from round the head, flaring out, its rim cut into tips.
const CROWN = { foot: [3.3, 22.4] satisfies Flat, top: [6.6, 28.6] satisfies Flat, half: 0.6 }

function crownTips(p: Vec): number {
    return Math.abs(Math.sin(Math.atan2(p[0], p[1]) * 6)) * 1.4
}

function crown(p: Vec): number {
    const top: Flat = [CROWN.top[0], CROWN.top[1] - crownTips(p)]
    return segment([length2(p[0], p[1]), p[2]], CROWN.foot, top) - CROWN.half
}

function crownFinish(p: Vec): Finish {
    const rise = (p[2] - CROWN.foot[1]) / (CROWN.top[1] - CROWN.foot[1])
    if (rise > 0.72) return { wood: false, tone: 1.45 }
    if (rise < 0.18) return { wood: false, tone: 0.8 }
    return { wood: false, tone: 1 + 0.1 * Math.cos(Math.atan2(p[0], p[1]) * 22) }
}

// The cut-out: a flat outline of capsules, thickened and rounded at the edges.
const CUTOUT = { half: 3.3, round: 1.3 }
const LIMBS: readonly [Flat, Flat, number][] = [
    [[0, 8], [0, 15], 5.2],
    [[-10, 11.2], [0, 15.4], 2.9],
    [[10, 11.2], [0, 15.4], 2.9],
    [[-5.4, 2.8], [0, 10], 3.3],
    [[5.4, 2.8], [0, 10], 3.3]
]
const HEAD_2D = { at: [0, 21.6] satisfies Flat, radius: 4.3 }
const PLUMES: readonly [Flat, Flat, number][] = [
    [[0, 24.5], [0, 29.4], 1.5],
    [[-2.2, 24], [-6, 28.2], 1.35],
    [[2.2, 24], [6, 28.2], 1.35]
]

function outline2(x: number, z: number): { body: number; plume: number } {
    let body = length2(x - HEAD_2D.at[0], z - HEAD_2D.at[1]) - HEAD_2D.radius
    for (const [a, b, r] of LIMBS) body = blend(body, segment([x, z], a, b) - r, 1.8)
    let plume = Infinity
    for (const [a, b, r] of PLUMES) plume = Math.min(plume, segment([x, z], a, b) - r)
    return { body, plume }
}

function cutout(p: Vec): number {
    const { body, plume } = outline2(p[0], p[2])
    const flat = blend(body, plume, 1.2) + CUTOUT.round
    const across = Math.abs(p[1]) - CUTOUT.half + CUTOUT.round
    const inside = Math.min(Math.max(flat, across), 0)
    const shape = inside + Math.hypot(Math.max(flat, 0), Math.max(across, 0)) - CUTOUT.round
    // Flat feet on the board.
    return Math.max(shape, -p[2])
}

function cutoutFinish(p: Vec): Finish {
    const { body, plume } = outline2(p[0], p[2])
    if (plume < body) return { wood: false, tone: 1.45 }
    if (p[2] > HEAD_2D.at[1] - 3 && length2(p[0], p[2] - HEAD_2D.at[1]) < HEAD_2D.radius + 0.4) {
        return { wood: true, tone: 1 }
    }
    return { wood: false, tone: 1 }
}

const FIGURES: Record<PilliDesign, Figure> = {
    fan: {
        scene: (p) => Math.max(Math.min(noble(p), fan(p)), -p[2]),
        finish: (p) => (fan(p) < noble(p) ? fanFinish(p) : nobleFinish(p))
    },
    crown: {
        scene: (p) => Math.max(Math.min(noble(p), crown(p)), -p[2]),
        finish: (p) => (crown(p) < noble(p) ? crownFinish(p) : nobleFinish(p))
    },
    cutout: { scene: cutout, finish: cutoutFinish }
}
