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
    normalize,
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
    normalAt,
    occlusion,
    outlineOf,
    type Sample,
    type Scene,
    softShadow
} from './raymarch.js'

const WOOD = { light: linear('#e2bf91'), dark: linear('#b98a5a'), late: linear('#93683f') }
// Turned wood: growth rings round the upright axis the head was turned on, wandering a little,
// so the top shows rings and the sides streaks, and the wood itself mottled; matte.
const WOOD_GRAIN = { spacing: 0.55, wander: 1.4, mottle: 0.3 }
const grainNoise = fractal(noise2(173), 3)

function woodAt(p: Vec, strength: number): Rgb {
    const wander = (grainNoise(p[0] * 0.35 + p[1] * 0.35, p[2] * 0.12) - 0.5) * WOOD_GRAIN.wander
    const radius = length2(p[0] - HEAD.at[0], p[1] - HEAD.at[1]) + wander
    const ring = 0.5 + 0.5 * Math.sin((radius / WOOD_GRAIN.spacing) * 2 * Math.PI)
    const tone = 0.6 + (grainNoise(p[0] * 0.8 + 5, p[2] * 0.8) - 0.5) * WOOD_GRAIN.mottle * 2
    const body = mix(WOOD.dark, WOOD.light, clamp(tone))
    return mix(body, WOOD.late, smoothstep(0.55, 0.95, ring) * strength)
}
const GOLD = { light: linear('#f0c85a'), dark: linear('#8a5a1c') }
const TURQUOISE = { light: linear('#4cc3b4'), dark: linear('#0f5e5a') }
// The light on a painted face turned towards it shows the paint as it is.
const FULL_LIGHT = 0.95

// What a point of the figure is made of: paint, lightened (above 1) or darkened (below) by
// what is painted there, bare wood, gold or turquoise.
type Finish = { kind: 'paint' | 'wood' | 'gold' | 'turquoise'; tone: number }
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
        (p) => shade(p, figure, toward, style.grain),
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

// `below` is the paving reflected in the satin paint, which shows on dark paint only.
function shineOf(p: Vec, normal: Vec, scene: Scene, tone: number, below: number): Sample {
    const edge = smoothstep(DRY_BRUSH.from, DRY_BRUSH.to, bend(p, scene))
    const up = 0.5 + 0.5 * clamp(normal[2])
    // Strokes drawn up and down the figure.
    const stroke = 0.35 + 0.65 * smoothstep(0.32, 0.68, brush(p[0] * 1.1 + p[1] * 1.1, p[2] * 0.3))
    const detail = DRY_BRUSH.lighter * clamp((tone - 1) / 0.4)
    const brushed = DRY_BRUSH.strength * edge * up * stroke
    return { color: [1, 1, 1], alpha: clamp(brushed + detail + srgb(below)) }
}

// Lit as ZÈRTZ lights its pieces: a key light from above, to the left and a little in front,
// so the side towards the viewer shows its form; little light besides; the edges turned from
// the viewer reflecting the room above, as satin paint does. The paving below shows in it too,
// but only on dark paint, where it gives the foot its edge; it clouded lighter paint.
const KEY: Vec = normalize([-0.62, 0.24, 0.75])
const AMBIENT = 0.22
const ROOM = 0.32
const PAVING = 0.5
const SATIN = 0.45

function fresnel(cosine: number): number {
    return 0.04 + 0.96 * (1 - clamp(cosine)) ** 5
}

// In sRGB, as the page lays it over the paint.
function shade(p: Vec, figure: Figure, toward: Vec, grain: number): Sample[] {
    const normal = normalAt(p, figure.scene)
    const sun = clamp(dot(normal, KEY)) * softShadow(p, normal, figure.scene, KEY)
    const occluded =
        occlusion(p, normal, figure.scene) * (0.6 + 0.4 * smoothstep(-0.85, 0.2, normal[2]))
    const sky = AMBIENT * (0.7 + 0.3 * normal[2])
    const light = (sky + 0.95 * sun) * occluded
    const mirror = add(scale(normal, 2 * dot(normal, toward)), scale(toward, -1))
    const sheen = fresnel(dot(normal, toward)) * occluded
    const glance = sheen * ROOM * (1 - smoothstep(0, -0.35, mirror[2]))
    const below = sheen * PAVING * smoothstep(0, -0.35, mirror[2]) * SATIN
    const finish = figure.finish(p)
    if (finish.kind === 'wood') return opaque(scale(woodAt(p, grain), light))
    if (finish.kind === 'gold') {
        const half = normalize(add(KEY, toward))
        const facing = clamp(dot(normal, half))
        const metal = mix(GOLD.dark, GOLD.light, clamp(sun * 0.7 + facing ** 4 * 0.5))
        const shine = 0.8 * facing ** 24
        return opaque(add(scale(metal, 0.3 + 0.8 * light), [shine, shine * 0.9, shine * 0.6]))
    }
    if (finish.kind === 'turquoise') {
        const half = normalize(add(KEY, toward))
        const polish = 0.25 * clamp(dot(normal, half)) ** 30
        const stone = mix(TURQUOISE.dark, TURQUOISE.light, 0.5 + 0.5 * sun)
        return opaque(add(scale(stone, 0.35 + 0.75 * light), [polish, polish, polish]))
    }
    // As a factor on the paint's sRGB colour; more than full light, and the satin's
    // reflections, lighten it.
    const factor = ((light / FULL_LIGHT) * finish.tone) ** (1 / 2.2)
    const white = clamp(Math.max(0, factor - 1) * 0.6 + srgb(glance * SATIN))
    const keep = Math.min(factor, 1) * (1 - white)
    const alpha = 1 - keep
    const shine = shineOf(p, normal, figure.scene, finish.tone, below)
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
const STONE: Finish = { kind: 'turquoise', tone: 1 }

// The robe up to the neck, the cape over the shoulders, the head on top.
const ROBE = { foot: 8.6, neck: 4.6, height: 15.5, round: 1.3 }
const PLINTH = { height: 1.8, radius: 9.1, round: 0.45 }
const CAPE: Vec = [6.4, 4.6, 2.9]
const CAPE_AT = 15.6
// The head stands clear of the cape on a short neck, so its face shows from the table's side.
const HEAD = { radius: 3.7, at: [0, 0.3, 22.4] satisfies Vec }
const NECK = { from: [0, 0.1, 17.6] satisfies Vec, radius: 1.9 }
// The band round the hem, clear of the ring at the foot: a raised line along each edge and
// between them a stepped fret, repeating a whole number of times round the robe.
const HEM = {
    foot: 2.3,
    top: 5.1,
    repeats: 8,
    steps: 2,
    line: 0.32,
    soft: 0.14,
    bevel: 0.3,
    studs: 18,
    stud: 0.55,
    teeth: 12
}

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
    return blend(body, plinth, 0.35)
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

// A capsule narrowing from radius `ra` at `a` to `rb` at `b`: close to a distance where the
// taper is gentle.
function taper(p: Vec, a: Vec, b: Vec, ra: number, rb: number): number {
    const ab: Vec = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
    const ap: Vec = [p[0] - a[0], p[1] - a[1], p[2] - a[2]]
    const t = clamp(dot(ap, ab) / dot(ab, ab))
    const off = Math.hypot(ap[0] - ab[0] * t, ap[1] - ab[1] * t, ap[2] - ab[2] * t)
    return (off - (ra + (rb - ra) * t)) * 0.9
}

// The cloak's two corners tied in a knot, over the right shoulder or at the chest: two loops
// either side of the knot, and the two ends hanging down over the robe.
type Knot = { core: Vec; ends: [Vec, Vec] }
const KNOT = 1.5

function knotOf(style: PilliStyle): Knot | undefined {
    if (style.knot === 'none') return undefined
    const [x, z] = style.knot === 'shoulder' ? [-2.7, CAPE_AT + 0.5] : [0, CAPE_AT - 0.7]
    const onCape = (x: number, z: number) =>
        CAPE[1] * Math.sqrt(Math.max(0, 1 - (x / CAPE[0]) ** 2 - ((z - CAPE_AT) / CAPE[2]) ** 2))
    const onRobe = (x: number, z: number) =>
        Math.sqrt(Math.max(0, robeRadius(style, z) ** 2 - x * x))
    const end = (dx: number, drop: number): Vec => {
        const ex = x + dx
        const ez = z - drop
        return [ex, Math.max(onRobe(ex, ez), onCape(ex, ez)) + 0.3 * KNOT, ez]
    }
    return {
        core: [x, onCape(x, z) + 0.45 * KNOT, z],
        ends: [end(-0.8 * KNOT, 3.4 * KNOT), end(0.7 * KNOT, 3 * KNOT)]
    }
}

function knot(knot: Knot, p: Vec): number {
    const c = knot.core
    const at = (dx: number, dy: number, dz: number): Vec => [
        p[0] - c[0] - dx * KNOT,
        p[1] - c[1] - dy * KNOT,
        p[2] - c[2] - dz * KNOT
    ]
    const sized = (radii: Vec): Vec => scale(radii, KNOT)
    const core = ellipsoid(at(0, 0, 0), sized([0.95, 0.7, 0.8]))
    const loops = Math.min(
        ellipsoid(at(-0.95, -0.15, 0.25), sized([0.75, 0.5, 0.62])),
        ellipsoid(at(0.95, -0.15, 0.15), sized([0.75, 0.5, 0.62]))
    )
    const start = (dx: number): Vec => [c[0] + dx * KNOT, c[1] + 0.15 * KNOT, c[2] - 0.55 * KNOT]
    const ends = Math.min(
        taper(p, start(-0.35), knot.ends[0], 0.55 * KNOT, 0.3 * KNOT),
        taper(p, start(0.35), knot.ends[1], 0.55 * KNOT, 0.3 * KNOT)
    )
    return Math.min(blend(core, loops, 0.35 * KNOT), blend(core, ends, 0.3 * KNOT))
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
        shape = Math.min(shape, cord(p))
        // The relief's slopes make the distance change faster than distance, so rays step
        // more carefully over it, or some stop inside and take a false shadow.
        const raised = relief(style, p)
        if (raised !== 0) shape = (shape - raised) * 0.6
        if (style.hem === 'studs') shape = Math.min(shape, studs(style, p))
    }
    const tied = knotOf(style)
    if (tied) shape = blend(shape, knot(tied, p), 0.25)
    return shape
}

const RELIEF = { fret: 0.26, line: 0.22, opening: 0.28, cord: 0.5 }
const CAPE_EDGE = CAPE_AT - CAPE[2] * 0.55

// A cord along the cape's lower edge.
function cord(p: Vec): number {
    const cape = ellipsoid([p[0], p[1], p[2] - CAPE_AT], CAPE)
    return length2(cape, p[2] - CAPE_EDGE) - RELIEF.cord
}

// The fret and the hem's edge lines stand out from the robe, and the cloak's opening is cut
// into its front.
function relief(style: PilliStyle, p: Vec): number {
    if (p[2] > HEM.foot - HEM.line && p[2] < HEM.top + HEM.line) {
        return Math.max(RELIEF.line * hemLine(p), RELIEF.fret * hemPattern(style, p))
    }
    if (p[2] > HEM.top && p[2] < CAPE_AT - 2 && openingAt(p)) return -RELIEF.opening
    return 0
}

function openingAt(p: Vec): boolean {
    return p[1] > 0 && Math.abs(Math.atan2(p[0], p[1])) < 0.05
}

// How fully a point is on one of the hem's edge lines, softened at their edges.
function hemLine(p: Vec): number {
    const off = Math.min(Math.abs(p[2] - HEM.foot), Math.abs(p[2] - HEM.top))
    return 1 - smoothstep(HEM.line / 2 - HEM.soft, HEM.line / 2 + HEM.soft, off)
}

function hemPattern(style: PilliStyle, p: Vec): number {
    if (style.hem === 'fret') return fret(p)
    if (style.hem === 'triangles') return triangles(style, p)
    return 0
}

// Raised triangles standing on the lower line, their tips just short of the upper one.
function triangles(style: PilliStyle, p: Vec): number {
    const turn = (Math.atan2(p[0], p[1]) / (2 * Math.PI)) * HEM.teeth
    const s = turn - Math.floor(turn)
    const floor = HEM.foot + HEM.line
    const height = HEM.top - HEM.line - floor - 0.25
    const top = floor + height * (1 - Math.abs(2 * s - 1))
    // Across the slanted edges rather than straight down.
    const width = (2 * Math.PI * robeRadius(style, p[2])) / HEM.teeth
    const slant = 1 / Math.hypot(1, (2 * height) / width)
    return (
        smoothstep(-HEM.bevel, HEM.bevel, (top - p[2]) * slant) *
        smoothstep(-HEM.bevel, HEM.bevel, p[2] - floor)
    )
}

// Round studs in a ring between the hem's lines, standing on the robe.
function studs(style: PilliStyle, p: Vec): number {
    const z = (HEM.foot + HEM.top) / 2
    const turn = Math.atan2(p[0], p[1]) / (2 * Math.PI)
    const nearest = (Math.round(turn * HEM.studs) / HEM.studs) * 2 * Math.PI
    const r = robeRadius(style, z) - 0.1
    const centre: Vec = [Math.sin(nearest) * r, Math.cos(nearest) * r, z]
    return sphere(p, centre, HEM.stud)
}

// How fully a point is on the stepped fret: steps rising to a peak and falling again between
// the edge lines, each step's edges softened.
function fret(p: Vec): number {
    const turn = (Math.atan2(p[0], p[1]) / (2 * Math.PI)) * HEM.repeats
    const s = turn - Math.floor(turn)
    const climb = (s < 0.5 ? s : 1 - s) * 2 * HEM.steps
    const whole = Math.floor(climb)
    const level = (whole + smoothstep(1 - 0.18, 1, climb - whole)) / HEM.steps
    const inner = HEM.line
    const height = HEM.top - HEM.foot - 2 * inner
    const top = HEM.foot + inner + height * (0.2 + 0.8 * level)
    const above = p[2] - (HEM.foot + inner)
    return (
        smoothstep(-HEM.bevel, HEM.bevel, above) *
        (1 - smoothstep(-HEM.bevel, HEM.bevel, p[2] - top))
    )
}

function bodyFinish(style: PilliStyle, p: Vec): Finish {
    if (style.arms && arms(style, p) < 0.2) return paint(0.95)
    const tied = knotOf(style)
    if (tied && knot(tied, p) < 0.15) return paint(1.08)
    if (style.trim) {
        if (p[2] > HEM.foot - HEM.line && p[2] < HEM.top + HEM.line) {
            const studded = style.hem === 'studs' && studs(style, p) < 0.15 ? 1 : 0
            return paint(0.8 + 0.45 * Math.max(hemPattern(style, p), hemLine(p), studded))
        }
        if (p[2] > HEM.top && p[2] < CAPE_AT - 2 && openingAt(p)) return paint(0.7)
        if (cord(p) < 0.15) return paint(1.2)
    }
    if (style.robe === 'bell' && p[2] < 2.4) return paint(0.72)
    if (!style.trim && Math.abs(p[2] - CAPE_EDGE) < 0.7) return paint(1.3)
    return paint()
}

function head(p: Vec): number {
    return sphere(p, HEAD.at, HEAD.radius)
}

// The head and neck, turned from one piece of wood.
const NECKED: Part = {
    distance: (p) => blend(head(p), capsule(p, NECK.from, HEAD.at, NECK.radius), 0.6),
    finish: () => WOODEN
}

// A gold circlet high on the brow: a flat strip following the curve of the head, its edges
// rounded, with a medallion set with turquoise at the front.
const CIRCLET = { rise: 1.9, height: 0.95, depth: 0.32, round: 0.14, medallion: 1.05, disc: 0.32 }
const MEDALLION: Vec = [
    0,
    HEAD.at[1] + Math.sqrt(HEAD.radius ** 2 - CIRCLET.rise ** 2) + CIRCLET.depth + 0.12,
    HEAD.at[2] + CIRCLET.rise
]

function circletBand(p: Vec): number {
    const z = p[2] - HEAD.at[2]
    const onHead = Math.sqrt(Math.max(0, HEAD.radius ** 2 - z * z))
    const qx = length2(p[0], p[1] - HEAD.at[1]) - onHead - CIRCLET.depth / 2 + 0.05
    const qz = z - CIRCLET.rise
    const ax = Math.abs(qx) - CIRCLET.depth / 2 + CIRCLET.round
    const az = Math.abs(qz) - CIRCLET.height / 2 + CIRCLET.round
    const box = Math.min(Math.max(ax, az), 0) + length2(Math.max(ax, 0), Math.max(az, 0))
    return (box - CIRCLET.round) * 0.8
}

// A disc `radius` across and `depth` thick, facing the viewer, its edge rounded.
function medallion(p: Vec, radius: number, depth: number): number {
    const along = Math.abs(p[1] - MEDALLION[1]) - depth / 2
    const out = length2(p[0] - MEDALLION[0], p[2] - MEDALLION[2]) - radius
    const round = Math.min(depth / 2, 0.2)
    const qx = out + round
    const qy = along + round
    return Math.min(Math.max(qx, qy), 0) + length2(Math.max(qx, 0), Math.max(qy, 0)) - round
}

const CIRCLETED: Part = {
    distance: (p) => Math.min(circletBand(p), medallion(p, CIRCLET.medallion, CIRCLET.disc)),
    finish: (p) => (medallion(p, CIRCLET.medallion * 0.55, CIRCLET.disc + 0.1) < 0 ? STONE : GILT)
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
        NECKED,
        ...fans.map((fan) => ({
            distance: (p: Vec) => shapeOf(fan, p),
            finish: (p: Vec) => fanFinish(style, fan, p)
        }))
    ]
    if (style.arms) {
        const hands = armEnds(style).hands
        parts.push({ distance: (p) => sphere(p, hands, 1.5), finish: () => WOODEN })
    }
    parts.push(CIRCLETED)
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
