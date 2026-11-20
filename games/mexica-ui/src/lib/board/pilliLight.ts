// A Pilli Mexica, lit pixel by pixel by marching rays against its distance field. The board
// fills the figure's outline with its owner's colour and lays this image over it: where the
// figure is painted, the image holds only the light, as black that darkens the paint and white
// that lights it; bare wood and gold show as themselves. So one image serves every player colour.
// Only scripts/render-looks.mjs runs this, through the /looks page; rerun it after changing the
// figure.
import {
    add,
    type Bitmap,
    clamp,
    dot,
    fractal,
    linear,
    mix,
    noise2,
    type Rgb,
    scale,
    smoothstep,
    srgb,
    type Vec
} from './light.js'
import { PILLI_PIXELS, PILLI_STYLE, type PilliStyle, pilliBounds } from './pilliShape.js'
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
const GOLD = { light: linear('#f0c85a'), dark: linear('#8a5a1c') }
// The light on a painted face turned up towards it shows the paint as it is.
const FULL_LIGHT = 0.92

// What a point of the figure is made of: paint, lightened (above 1) or darkened (below) by
// what is painted there, bare wood or gold.
type Finish = { kind: 'paint' | 'wood' | 'gold'; tone: number }
type Part = { distance: (p: Vec) => number; finish: (p: Vec) => Finish }
type Figure = { scene: Scene; finish: (p: Vec) => Finish }

// The figure's light over its paint, a second layer of light for dark paint, and its outline.
export type PilliLook = { bitmap: Bitmap; shine: Bitmap; outline: string }

export function renderPilli(
    tilt: number,
    style: PilliStyle = PILLI_STYLE,
    pixels = PILLI_PIXELS
): PilliLook {
    const box = pilliBounds(tilt)
    const full = figureOf(style)
    const figure: Figure = {
        scene: (p) => full.scene(scale(p, 1 / PILLI_SIZE)) * PILLI_SIZE,
        finish: (p) => full.finish(scale(p, 1 / PILLI_SIZE))
    }
    const toward: Vec = [0, Math.sqrt(1 - tilt * tilt), tilt]
    const { bitmaps, hits } = castRays(
        box,
        tilt,
        pixels,
        figure.scene,
        (p) => shade(p, figure, toward),
        (channel) => clamp(channel)
    )
    return { bitmap: bitmaps[0], shine: bitmaps[1], outline: outlineOf(hits, box, pixels) }
}

const opaque = (color: Rgb): Sample[] => [
    { color: [srgb(color[0]), srgb(color[1]), srgb(color[2])], alpha: 1 },
    NO_SHINE
]

const NO_SHINE: Sample = { color: [1, 1, 1], alpha: 0 }

// Dark paint hides the figure's shape and the details on it, so a second layer lights it as a
// painter dry-brushes a miniature: pale paint caught on the edges and ridges that stand out,
// more on those facing up, in streaks, and on the lighter details painted on it. The board lays
// it over dark paint only.
const DRY_BRUSH = { probe: 0.45, from: 0.3, to: 1.6, strength: 0.8, lighter: 0.25 }
const brush = fractal(noise2(151), 3)

// How sharply the surface bends outward at a point on it: positive on edges and ridges, about
// 2 / radius on a ball, negative in grooves.
function bend(p: Vec, scene: Scene): number {
    const e = DRY_BRUSH.probe
    let sum = -6 * scene(p)
    for (const axis of [0, 1, 2]) {
        const step: Vec = [0, 0, 0]
        step[axis] = e
        sum += scene(add(p, step)) + scene(add(p, scale(step, -1)))
    }
    return sum / (e * e)
}

function shineOf(p: Vec, normal: Vec, scene: Scene, tone: number): Sample {
    const edge = smoothstep(DRY_BRUSH.from, DRY_BRUSH.to, bend(p, scene))
    const up = 0.5 + 0.5 * clamp(normal[2])
    // Strokes drawn up and down the figure.
    const stroke = 0.35 + 0.65 * smoothstep(0.32, 0.68, brush(p[0] * 1.1 + p[1] * 1.1, p[2] * 0.3))
    const detail = tone > 1.05 ? DRY_BRUSH.lighter : 0
    return { color: [1, 1, 1], alpha: clamp(DRY_BRUSH.strength * edge * up * stroke + detail) }
}

// In sRGB, as the page lays it over the paint.
function shade(p: Vec, figure: Figure, toward: Vec): Sample[] {
    const normal = normalAt(p, figure.scene)
    const sun = clamp(dot(normal, LIGHT)) * (0.3 + 0.7 * softShadow(p, normal, figure.scene))
    const sky = 0.14 * Math.max(0, normal[1]) + 0.12 * Math.max(0, normal[2])
    const light = (0.38 + 0.62 * sun + sky) * occlusion(p, normal, figure.scene)
    const finish = figure.finish(p)
    const bounce = add(scale(normal, 2 * dot(normal, LIGHT)), scale(LIGHT, -1))
    const facing = clamp(dot(bounce, toward))
    if (finish.kind === 'wood') {
        const grain = mix(WOOD.dark, WOOD.light, 0.55 + 0.45 * Math.sin(p[2] * 2.1 + p[0] * 0.4))
        return opaque(scale(grain, light * 1.05))
    }
    if (finish.kind === 'gold') {
        const metal = mix(GOLD.dark, GOLD.light, clamp(sun * 0.8 + facing ** 4 * 0.6))
        const shine = 0.9 * facing ** 16
        return opaque(add(scale(metal, 0.35 + 0.75 * light), [shine, shine * 0.9, shine * 0.6]))
    }
    // As a factor on the paint's sRGB colour; more than full light lightens it.
    const factor = ((light / FULL_LIGHT) * finish.tone) ** (1 / 2.2)
    // Matte paint: no gloss, only the light past full lightening it.
    const white = clamp(Math.max(0, factor - 1) * 0.6)
    const keep = Math.min(factor, 1) * (1 - white)
    const alpha = 1 - keep
    const shine = shineOf(p, normal, figure.scene, finish.tone)
    if (alpha <= 0) return [{ color: [0, 0, 0], alpha: 0 }, shine]
    const grey = white / alpha
    return [{ color: [grey, grey, grey], alpha }, shine]
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

const paint = (tone = 1): Finish => ({ kind: 'paint', tone })
const WOODEN: Finish = { kind: 'wood', tone: 1 }
const GILT: Finish = { kind: 'gold', tone: 1 }

// The robe up to the neck, the cape over the shoulders, the head on top.
const ROBE = { foot: 8.6, neck: 4.6, height: 15.5, round: 1.3 }
const PLINTH = { height: 1.8, radius: 9.1, round: 0.7 }
const CAPE: Vec = [6.4, 4.6, 2.9]
const CAPE_AT = 15.6
const HEAD = { radius: 3.7, at: [0, 0.3, 21.2] satisfies Vec }
const HEM = { foot: 1.4, top: 3.8, period: 3.2 }

// The pawn's radius at a height: flaring out towards the foot.
function pawnRadius(z: number): number {
    const t = clamp(z / ROBE.height)
    return ROBE.neck + (ROBE.foot - 0.5 - ROBE.neck) * (1 - t) ** 2
}

function pawnSlope(z: number): number {
    const t = clamp(z / ROBE.height)
    return (-2 * (ROBE.foot - 0.5 - ROBE.neck) * (1 - t)) / ROBE.height
}

function robeRadius(style: PilliStyle, z: number): number {
    if (style.robe === 'pawn') return pawnRadius(z)
    return ROBE.foot + ((ROBE.neck - ROBE.foot) * z) / ROBE.height
}

function robe(style: PilliStyle, p: Vec): number {
    if (style.robe === 'bell') {
        return frustum(p, 0, ROBE.height, ROBE.foot, ROBE.neck, ROBE.round)
    }
    const r = length2(p[0], p[1])
    const flare = (r - pawnRadius(p[2])) / Math.hypot(1, pawnSlope(p[2]))
    const body = Math.max(flare, p[2] - ROBE.height)
    const plinth = frustum(p, 0, PLINTH.height, PLINTH.radius, PLINTH.radius - 0.3, PLINTH.round)
    return blend(body, plinth, 0.9)
}

// Forearms from the shoulders to hands clasped in front, standing just off the robe.
function armEnds(style: PilliStyle): { shoulder: Vec; wrist: Vec; hands: Vec } {
    const wristZ = 10.6
    const front = robeRadius(style, wristZ) + 1.1
    return {
        shoulder: [5.4, 2.6, 14.2],
        wrist: [1.5, front, wristZ],
        hands: [0, front + 0.3, wristZ - 0.2]
    }
}

function capsule(p: Vec, a: Vec, b: Vec, radius: number): number {
    const ab: Vec = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
    const ap: Vec = [p[0] - a[0], p[1] - a[1], p[2] - a[2]]
    const t = clamp(dot(ap, ab) / dot(ab, ab))
    return Math.hypot(ap[0] - ab[0] * t, ap[1] - ab[1] * t, ap[2] - ab[2] * t) - radius
}

function arms(style: PilliStyle, p: Vec): number {
    const { shoulder, wrist } = armEnds(style)
    const mirrored: Vec = [Math.abs(p[0]), p[1], p[2]]
    return capsule(mirrored, shoulder, wrist, 1.35)
}

function body(style: PilliStyle, p: Vec): number {
    const cape = ellipsoid([p[0], p[1], p[2] - CAPE_AT], CAPE)
    let shape = blend(robe(style, p), cape, 1.6)
    if (style.arms) shape = blend(shape, arms(style, p), 0.7)
    if (style.trim) {
        shape = Math.min(shape, sphere(p, [2.9, 3.6, CAPE_AT + 0.4], 1.05), cord(p))
        shape -= relief(p)
    }
    return shape
}

const ROBE_AT_HEM = 8
const RELIEF = { fret: 0.32, opening: 0.28, cord: 0.5 }
const CAPE_EDGE = CAPE_AT - CAPE[2] * 0.55

// A cord along the cape's lower edge.
function cord(p: Vec): number {
    const cape = ellipsoid([p[0], p[1], p[2] - CAPE_AT], CAPE)
    return length2(cape, p[2] - CAPE_EDGE) - RELIEF.cord
}

// The fret stands out from the hem and the cloak's opening is cut into its front.
function relief(p: Vec): number {
    if (p[2] > HEM.foot && p[2] < HEM.top) return fret(p) ? RELIEF.fret : 0
    if (p[2] > HEM.top && p[2] < CAPE_AT - 2 && openingAt(p)) return -RELIEF.opening
    return 0
}

function openingAt(p: Vec): boolean {
    return p[1] > 0 && Math.abs(Math.atan2(p[0], p[1])) < 0.05
}

// The stepped fret: steps rising and falling round the hem, a lighter paint.
function fret(p: Vec): boolean {
    const around = Math.atan2(p[0], p[1]) * ROBE_AT_HEM
    const s = (((around / HEM.period) % 1) + 1) % 1
    const h = (p[2] - HEM.foot) / (HEM.top - HEM.foot)
    const step = Math.floor((s < 0.5 ? s : 1 - s) * 8) / 4
    return h > 0.12 && h < 0.88 && h - 0.12 < step * 0.76 + 0.1
}

function bodyFinish(style: PilliStyle, p: Vec): Finish {
    if (style.arms && arms(style, p) < 0.2) return paint(0.95)
    if (style.trim) {
        if (p[2] > HEM.foot && p[2] < HEM.top) return paint(fret(p) ? 1.35 : 0.78)
        if (p[2] > HEM.top && p[2] < CAPE_AT - 2 && openingAt(p)) return paint(0.7)
        if (cord(p) < 0.15) return paint(1.2)
        if (sphere(p, [2.9, 3.6, CAPE_AT + 0.4], 1.05) < 0.2) return paint(1.25)
    }
    if (style.robe === 'pawn' && p[2] < PLINTH.height + 0.2) return paint(0.8)
    if (style.robe === 'bell' && p[2] < 2.4) return paint(0.72)
    if (!style.trim && Math.abs(p[2] - CAPE_EDGE) < 0.7) return paint(1.3)
    return paint()
}

function head(p: Vec): number {
    return sphere(p, HEAD.at, HEAD.radius)
}

const BAND = { at: HEAD.at[2] + 1.1, radius: 3.55, thickness: 0.62 }
const JEWEL: Vec = [0, HEAD.at[1] + 3.75, BAND.at + 0.1]

function headband(p: Vec): number {
    const around = length2(p[0], p[1] - HEAD.at[1]) - BAND.radius
    return Math.min(length2(around, p[2] - BAND.at) - BAND.thickness, sphere(p, JEWEL, 0.95))
}

// A fan stands behind the head, leaning back; its feathers spread from a point below its
// centre.
type Fan = { centre: Vec; radii: Vec; lean: number; spacing: number; tone: number }
const BACK_FAN: Fan = {
    centre: [0, -3.4, 25],
    radii: [7.8, 0.9, 6.4],
    lean: 0.42,
    spacing: 0.27,
    tone: 1
}
const FRONT_FAN: Fan = {
    centre: [0, -1.9, 23.3],
    radii: [5.6, 0.8, 4.4],
    lean: 0.25,
    spacing: 0.32,
    tone: 1.18
}

type FanPoint = { q: Vec; angle: number; along: number; reach: number; across: number }

function fanPoint(fan: Fan, p: Vec): FanPoint {
    const [x, y, z] = [p[0] - fan.centre[0], p[1] - fan.centre[1], p[2] - fan.centre[2]]
    const c = Math.cos(fan.lean)
    const s = Math.sin(fan.lean)
    const q: Vec = [x, y * c + z * s, -y * s + z * c]
    const below = fan.radii[2] * 0.75
    const angle = Math.atan2(q[0], q[2] + below)
    const along = length2(q[0], q[2] + below)
    const reach = length2(q[0] / fan.radii[0], q[2] / fan.radii[2])
    // Across one feather, from -0.5 at one edge to 0.5 at the other.
    const across = angle / fan.spacing - Math.round(angle / fan.spacing)
    return { q, angle, along, reach, across }
}

function plainFan(fan: Fan, p: Vec): number {
    const { q, angle } = fanPoint(fan, p)
    const tips = Math.abs(Math.sin((angle * 9) / 1.2)) * 0.7
    const radii: Vec = [fan.radii[0] - tips, fan.radii[1], fan.radii[2] - tips]
    return ellipsoid(q, radii) * 0.8
}

// Separate feathers, each rounded across its width and parted from the next towards its tip.
function featherFan(fan: Fan, p: Vec): number {
    const { q, along, reach, across } = fanPoint(fan, p)
    const swell = 0.55 + 0.9 * (1 - 2 * Math.abs(across))
    const tip = (1 - Math.cos(across * Math.PI * 2)) * 0.45
    const radii: Vec = [fan.radii[0] - tip, fan.radii[1] * swell, fan.radii[2] - tip]
    const leaf = ellipsoid(q, radii) * 0.75
    const parting = Math.min((Math.abs(across) - 0.43) * fan.spacing * along, (reach - 0.5) * 4)
    return Math.max(leaf, parting)
}

function fanFinish(style: PilliStyle, fan: Fan, p: Vec): Finish {
    const { across, reach, along } = fanPoint(fan, p)
    if (style.fan === 'plain') {
        if (reach > 0.78) return paint(1.45)
        return paint(1 + 0.1 * Math.cos(across * Math.PI * 2 * 2.5))
    }
    if (style.eyes) {
        const spot = length2(across * fan.spacing * along, (reach - 0.66) * fan.radii[2])
        if (spot < 0.62) return paint(0.45)
        if (spot < 0.95) return paint(1.5)
        if (reach < 0.36) return paint(0.72 * fan.tone)
    }
    if (reach > 0.84) return paint(1.45)
    if (Math.abs(across) < 0.05 && reach > 0.2) return paint(0.8 * fan.tone)
    return paint(fan.tone)
}

function figureOf(style: PilliStyle): Figure {
    const fans = style.fan === 'tiered' ? [BACK_FAN, FRONT_FAN] : [BACK_FAN]
    const shapeOf = style.fan === 'plain' ? plainFan : featherFan
    const parts: Part[] = [
        { distance: (p) => body(style, p), finish: (p) => bodyFinish(style, p) },
        { distance: head, finish: () => WOODEN },
        ...fans.map((fan) => ({
            distance: (p: Vec) => shapeOf(fan, p),
            finish: (p: Vec) => fanFinish(style, fan, p)
        }))
    ]
    if (style.arms) {
        const hands = armEnds(style).hands
        parts.push({ distance: (p) => sphere(p, hands, 1.5), finish: () => WOODEN })
    }
    if (style.headband) parts.push({ distance: headband, finish: () => GILT })
    const nearest = (p: Vec) => {
        let best = parts[0]
        let distance = Infinity
        for (const part of parts) {
            const d = part.distance(p)
            if (d < distance) {
                distance = d
                best = part
            }
        }
        return { best, distance }
    }
    return {
        scene: (p) => Math.max(nearest(p).distance, -p[2]),
        finish: (p) => nearest(p).best.finish(p)
    }
}
