// A Pilli Mexica, lit pixel by pixel by marching rays against its distance field. The board
// fills the figure's outline with its owner's colour and lays this image over it: where the
// figure is painted, the image holds only the light, as black that darkens the paint and white
// that lights it; gold, shell and obsidian show as themselves. So one image serves every player
// colour.
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
import { PILLI, PILLI_PIXELS, pilliBounds } from './pilliShape.js'
import { FLAT } from './view.js'
import {
    castRays,
    normalAt,
    occlusion,
    outlineOf,
    type Sample,
    type Scene,
    softShadow
} from './raymarch.js'

const GOLD = { light: linear('#f0c85a'), dark: linear('#8a5a1c') }
const SHELL = linear('#efe6d2')
const OBSIDIAN = linear('#17140f')
// The light on a painted face turned towards it shows the paint as it is.
const FULL_LIGHT = 0.95

// What a point of the figure is made of: paint, lightened (above 1) or darkened (below) by
// what is painted there, gold, shell or obsidian.
type Finish = { kind: 'paint' | 'gold' | 'shell' | 'obsidian'; tone: number }
type Part = { distance: (p: Vec) => number; finish: (p: Vec) => Finish }
type Figure = { scene: Scene; finish: (p: Vec) => Finish }

// The figure's light over its paint, a second layer of light for dark paint, and its outline.
export type PilliLook = { bitmap: Bitmap; shine: Bitmap; outline: string }

export function renderPilli(tilt: number, pixels = PILLI_PIXELS, proportions = PILLI): PilliLook {
    const box = pilliBounds(tilt, proportions)
    const faceUp = tilt === FLAT
    const full = figureWith(proportions.headdress, faceUp)
    // From the board's units back to the figure as drawn; lying down, it keeps its width's
    // proportions every way.
    const tall = faceUp ? proportions.width : proportions.height
    const unscaled = (p: Vec): Vec => [
        p[0] / proportions.width,
        p[1] / proportions.width,
        p[2] / tall
    ]
    const figure: Figure = {
        scene: (p) => full.scene(unscaled(p)) * Math.min(proportions.width, tall),
        finish: (p) => full.finish(unscaled(p))
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

// `below` is the paving in the paint's faint sheen, which shows on dark paint only.
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
// so the side towards the viewer shows its form; little light besides. The paint is matte, as
// the stone round it is: the edges turned from the viewer keep only a faint sheen of the room
// above, and of the paving below on dark paint, where it gives the foot its edge. The gold is
// dulled to match.
const KEY: Vec = normalize([-0.62, 0.24, 0.75])
const AMBIENT = 0.22
const ROOM = 0.064
const PAVING = 0.1
const SATIN = 0.45
const GOLD_SHINE = 0.16

function fresnel(cosine: number): number {
    return 0.04 + 0.96 * (1 - clamp(cosine)) ** 5
}

// In sRGB, as the page lays it over the paint.
function shade(p: Vec, figure: Figure, toward: Vec): Sample[] {
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
    if (finish.kind === 'gold') {
        const half = normalize(add(KEY, toward))
        const facing = clamp(dot(normal, half))
        const metal = mix(GOLD.dark, GOLD.light, clamp(sun * 0.7 + facing ** 4 * 0.5))
        const shine = GOLD_SHINE * facing ** 24
        return opaque(add(scale(metal, 0.3 + 0.8 * light), [shine, shine * 0.9, shine * 0.6]))
    }
    if (finish.kind === 'shell') return opaque(scale(SHELL, 0.35 + 0.75 * light))
    if (finish.kind === 'obsidian') {
        const half = normalize(add(KEY, toward))
        const polish = 0.3 * clamp(dot(normal, half)) ** 40
        return opaque(add(scale(OBSIDIAN, 0.5 + light), [polish, polish, polish]))
    }
    // As a factor on the paint's sRGB colour; more than full light, and the sheen's
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
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]

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
const GILT: Finish = { kind: 'gold', tone: 1 }

// The robe flares like a pawn's down to a ring at the foot, a cape lies over the shoulders, and
// the head stands clear of the cape on a short neck.
const ROBE = { foot: 8.6, neck: 4.6, height: 15.5 }
const PLINTH = { height: 1.8, radius: 9.1, round: 0.45 }
const CAPE: Vec = [6.4, 4.6, 2.9]
const CAPE_AT = 15.6
const CAPE_EDGE = CAPE_AT - CAPE[2] * 0.55
const HEAD = { radius: 3.7, at: [0, 0.3, 22.4] satisfies Vec }
const NECK = { from: [0, 0.1, 17.6] satisfies Vec, radius: 1.9 }
// A band round the hem, clear of the ring at the foot: a raised line along each edge and a
// ring of studs between them.
const HEM = { foot: 2.3, top: 5.1, line: 0.32, soft: 0.14, studs: 18, stud: 0.55 }
const RELIEF = { line: 0.22, opening: 0.28, cord: 0.5 }

// The robe's radius at a height: flaring out towards the foot.
function robeRadius(z: number): number {
    const t = clamp(z / ROBE.height)
    return ROBE.neck + (ROBE.foot - 0.5 - ROBE.neck) * (1 - t) ** 2
}

function robeSlope(z: number): number {
    const t = clamp(z / ROBE.height)
    return (-2 * (ROBE.foot - 0.5 - ROBE.neck) * (1 - t)) / ROBE.height
}

function robe(p: Vec): number {
    const flare = (length2(p[0], p[1]) - robeRadius(p[2])) / Math.hypot(1, robeSlope(p[2]))
    const body = Math.max(flare, p[2] - ROBE.height)
    const plinth = frustum(p, 0, PLINTH.height, PLINTH.radius, PLINTH.radius - 0.3, PLINTH.round)
    return blend(body, plinth, 0.35)
}

function capsule(p: Vec, a: Vec, b: Vec, radius: number): number {
    const ab: Vec = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
    const ap: Vec = [p[0] - a[0], p[1] - a[1], p[2] - a[2]]
    const t = clamp(dot(ap, ab) / dot(ab, ab))
    return Math.hypot(ap[0] - ab[0] * t, ap[1] - ab[1] * t, ap[2] - ab[2] * t) - radius
}

function body(p: Vec): number {
    const cape = ellipsoid([p[0], p[1], p[2] - CAPE_AT], CAPE)
    let shape = Math.min(blend(robe(p), cape, 1.6), cord(p))
    // The relief's slopes make the distance change faster than distance, so rays step more
    // carefully over it, or some stop inside and take a false shadow.
    const raised = relief(p)
    if (raised !== 0) shape = (shape - raised) * 0.6
    return Math.min(shape, studs(p))
}

// A cord along the cape's lower edge.
function cord(p: Vec): number {
    const cape = ellipsoid([p[0], p[1], p[2] - CAPE_AT], CAPE)
    return length2(cape, p[2] - CAPE_EDGE) - RELIEF.cord
}

// The hem's edge lines stand out from the robe, and the cloak's opening is cut into its front.
function relief(p: Vec): number {
    if (p[2] > HEM.foot - HEM.line && p[2] < HEM.top + HEM.line) return RELIEF.line * hemLine(p)
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

// Round studs in a ring between the hem's lines, standing on the robe.
function studs(p: Vec): number {
    const z = (HEM.foot + HEM.top) / 2
    const turn = Math.atan2(p[0], p[1]) / (2 * Math.PI)
    const nearest = (Math.round(turn * HEM.studs) / HEM.studs) * 2 * Math.PI
    const r = robeRadius(z) - 0.1
    return sphere(p, [Math.sin(nearest) * r, Math.cos(nearest) * r, z], HEM.stud)
}

function bodyFinish(p: Vec): Finish {
    if (p[2] > HEM.foot - HEM.line && p[2] < HEM.top + HEM.line) {
        const studded = studs(p) < 0.15 ? 1 : 0
        return paint(0.8 + 0.45 * Math.max(hemLine(p), studded))
    }
    if (p[2] > HEM.top && p[2] < CAPE_AT - 2 && openingAt(p)) return paint(0.7)
    if (cord(p) < 0.15) return paint(1.2)
    return paint()
}

function head(p: Vec): number {
    return sphere(p, HEAD.at, HEAD.radius)
}

// The head and neck, painted as a hood that runs into the mask's frame.
const HOODED: Part = {
    distance: (p) => blend(head(p), capsule(p, NECK.from, HEAD.at, NECK.radius), 0.6),
    finish: () => paint(0.95)
}

// A mask after the one on the box, in the owner's paint, worn over the whole face with its
// features larger than life: a squared face in a raised frame, a heavy brow, bulging gold eyes
// ringed in black with obsidian pupils, a broad nose, an open mouth of shell teeth between
// lips, gold spools at the ears and a pendant at the chin. Its plate is part of a sphere
// `radius` round a point `sink` behind and `drop` below the head's centre, so it turns its face
// up towards the viewer; its outline is `half` wide, narrowing to `chin`, from `bottom` to `top`
// round the head's centre. The feathers spring from the frame's top.
const MASK = {
    radius: 7,
    sink: 2.7,
    drop: 1.6,
    thick: 0.55,
    half: 3.9,
    chin: 3.0,
    top: 2.7,
    bottom: -3.4
}
const FRAME = { width: 0.75, raise: 0.32, down: -1.4 }
const BROW = { z: 1.75, half: 3.1, radius: 0.62 }
// `ring` is the black line round each eye, as a share of its size.
const EYE = { x: 1.62, z: 0.72, width: 1.28, height: 0.72, pupil: 0.42, bulge: 0.3, ring: 0.22 }
const NOSE = { top: 1.0, tip: -0.8, radius: 0.88 }
const MOUTH = { z: -1.7, width: 2.05, height: 0.8, tooth: 0.6, lips: 0.3 }
const SPOOL = { x: 4.25, z: 0.15, radius: 1.12, depth: 0.45 }

const BLACK: Finish = { kind: 'obsidian', tone: 1 }
const WHITE: Finish = { kind: 'shell', tone: 1 }

// The point on the mask's face at (x, z) round the head's centre, `out` in front of it.
const onMask = (x: number, z: number, out = 0): Vec => [
    x,
    HEAD.at[1] -
        MASK.sink +
        Math.sqrt(Math.max(0, (MASK.radius + out) ** 2 - x * x - (z + MASK.drop) ** 2)),
    HEAD.at[2] + z
]

// How far (x, z), round the head's centre, lies outside the mask's outline: a rounded square
// above, narrowing to the chin below.
function maskOutline(x: number, z: number): number {
    const below = Math.max(0, -z) / -MASK.bottom
    const half = MASK.half + (MASK.chin - MASK.half) * below ** 1.5
    const corner = 1.3
    const qx = Math.abs(x) - half + corner
    const qz = (z > 0 ? z - MASK.top : -z + MASK.bottom) + corner
    return Math.min(Math.max(qx, qz), 0) + length2(Math.max(qx, 0), Math.max(qz, 0)) - corner
}

function maskSpherical(p: Vec, out: number, thick: number): number {
    const q: Vec = [
        p[0] - HEAD.at[0],
        p[1] - (HEAD.at[1] - MASK.sink),
        p[2] - (HEAD.at[2] - MASK.drop)
    ]
    return Math.max(Math.abs(Math.hypot(q[0], q[1], q[2]) - MASK.radius - out) - thick / 2, -q[1])
}

function nose(p: Vec): number {
    return capsule(
        p,
        onMask(0, NOSE.top, 0.2),
        onMask(0, NOSE.tip, NOSE.radius * 0.75),
        NOSE.radius
    )
}

function mask(p: Vec): number {
    const x = p[0] - HEAD.at[0]
    const z = p[2] - HEAD.at[2]
    const edge = maskOutline(x, z)
    const plate = Math.max(maskSpherical(p, 0, MASK.thick), edge)
    const frame = Math.max(
        maskSpherical(p, FRAME.raise / 2, MASK.thick + FRAME.raise),
        edge,
        -(edge + FRAME.width),
        FRAME.down - z
    )
    const brow = capsule(
        p,
        onMask(-BROW.half, BROW.z, 0.15),
        onMask(BROW.half, BROW.z, 0.15),
        BROW.radius
    )
    const eyes = Math.min(
        ...[-1, 1].map((side) =>
            ellipsoid(sub(p, onMask(side * EYE.x, EYE.z, -0.1)), [
                EYE.width,
                EYE.bulge + 0.3,
                EYE.height
            ])
        )
    )
    const lips = Math.min(
        ...[MOUTH.height, -MOUTH.height].map((dz) =>
            capsule(
                p,
                onMask(-MOUTH.width * 0.9, MOUTH.z + dz, 0.05),
                onMask(MOUTH.width * 0.9, MOUTH.z + dz, 0.05),
                MOUTH.lips
            )
        )
    )
    const spools = Math.min(
        ...[-1, 1].map((side) => {
            const at = onMask(side * SPOOL.x, SPOOL.z)
            const across = Math.hypot(p[0] - at[0], p[2] - at[2]) - SPOOL.radius
            const along = Math.abs(p[1] - at[1] - 0.1) - SPOOL.depth / 2
            return (
                Math.min(Math.max(across, along), 0) +
                length2(Math.max(across, 0), Math.max(along, 0))
            )
        })
    )
    const chin = onMask(0, MASK.bottom + 0.3, 0.1)
    const pendant = capsule(p, chin, add(chin, [0, 0.15, -1.0]), 0.45)
    const features = Math.min(brow, nose(p), eyes, lips)
    return Math.min(blend(Math.min(plate, frame), features, 0.3), spools, pendant)
}

function maskFinish(p: Vec): Finish {
    const x = p[0] - HEAD.at[0]
    const z = p[2] - HEAD.at[2]
    if (z < MASK.bottom + 0.2) return GILT
    const toSpool = Math.hypot(Math.abs(x) - SPOOL.x, z - SPOOL.z)
    if (toSpool < SPOOL.radius + 0.15) return toSpool < SPOOL.radius * 0.45 ? BLACK : GILT
    // The nose's sides stay paint, however close the eyes come.
    if (nose(p) > 0.08) {
        const inEye = Math.hypot((Math.abs(x) - EYE.x) / EYE.width, (z - EYE.z) / EYE.height)
        if (inEye < 1) return Math.hypot(Math.abs(x) - EYE.x, z - EYE.z) < EYE.pupil ? BLACK : GILT
        if (inEye < 1 + EYE.ring) return BLACK
    }
    if (Math.abs(x) < MOUTH.width * 0.85 && Math.abs(z - MOUTH.z) < MOUTH.height * 0.75) {
        const tooth = (((x / MOUTH.tooth) % 1) + 1) % 1 > 0.16
        return z > MOUTH.z - 0.05 && tooth ? WHITE : BLACK
    }
    if (maskOutline(x, z) > -FRAME.width - 0.05 && z > FRAME.down - 0.1) return paint(1.25)
    return paint(1.08)
}

// Two rows of feathers spring from the mask's frame and spread up and out, the front row
// shorter and lighter, each feather curving outward and down towards its tip as the plumes
// on the box do. A row's feathers spread from a point `below` its centre, as a share of its
// height, and it is cut off below that point; `bend` is how far its feathers curve.
type Fan = {
    centre: Vec
    radii: Vec
    lean: number
    spacing: number
    tone: number
    below: number
    bend: number
}
// Both rows rise from the top of the mask's frame, in front of the hood.
const CROWN_ROOT = HEAD.at[2] + MASK.top - 0.3
const BACK_FAN: Fan = {
    centre: [0, HEAD.at[1] + 1.3, CROWN_ROOT + 0.15 * 5.4],
    radii: [8.6, 0.9, 5.4],
    lean: 0.35,
    spacing: 0.3,
    tone: 1,
    below: 0.15,
    bend: 0.55
}
const FRONT_FAN: Fan = {
    centre: [0, HEAD.at[1] + 2.5, CROWN_ROOT + 0.15 * 3.9],
    radii: [6.2, 0.8, 3.9],
    lean: 0.2,
    spacing: 0.36,
    tone: 1.18,
    below: 0.15,
    bend: 0.55
}
type FanPoint = { q: Vec; angle: number; along: number; reach: number; across: number }

function fanPoint(fan: Fan, p: Vec): FanPoint {
    const [x, y, z] = [p[0] - fan.centre[0], p[1] - fan.centre[1], p[2] - fan.centre[2]]
    const c = Math.cos(fan.lean)
    const s = Math.sin(fan.lean)
    const q: Vec = [x, y * c + z * s, -y * s + z * c]
    const below = fan.radii[2] * fan.below
    // Each feather curves outward and down, more towards its tip: find the straight feather
    // the point lies on by turning it back towards the upright by that much.
    const r = length2(q[0], q[2] + below)
    const turned =
        Math.atan2(q[0], q[2] + below) - Math.tanh(q[0] / 0.6) * fan.bend * (r / fan.radii[0]) ** 2
    q[0] = r * Math.sin(turned)
    q[2] = r * Math.cos(turned) - below
    const angle = Math.atan2(q[0], q[2] + below)
    const along = length2(q[0], q[2] + below)
    const reach = length2(q[0] / fan.radii[0], q[2] / fan.radii[2])
    // Across one feather, from -0.5 at one edge to 0.5 at the other.
    const across = angle / fan.spacing - Math.round(angle / fan.spacing)
    return { q, angle, along, reach, across }
}

// Separate feathers, each rounded across its width and parted from the next towards its tip.
function featherFan(fan: Fan, p: Vec): number {
    const { q, along, reach, across } = fanPoint(fan, p)
    const swell = 0.55 + 0.9 * (1 - 2 * Math.abs(across))
    const tip = (1 - Math.cos(across * Math.PI * 2)) * 0.45
    const radii: Vec = [fan.radii[0] - tip, fan.radii[1] * swell, fan.radii[2] - tip]
    const leaf = ellipsoid(q, radii) * 0.6
    const parting = Math.min((Math.abs(across) - 0.43) * fan.spacing * along, (reach - 0.5) * 4)
    const root = -(q[2] + fan.radii[2] * fan.below)
    return Math.max(leaf, parting, root)
}

function fanFinish(fan: Fan, p: Vec): Finish {
    const { across, reach } = fanPoint(fan, p)
    if (reach > 0.84) return paint(1.45)
    if (Math.abs(across) < 0.05 && reach > 0.2) return paint(0.8 * fan.tone)
    return paint(fan.tone)
}

// A row of feathers scaled up from its foot.
function scaledFan(fan: Fan, by: number): Fan {
    const share = fan.below
    const foot = fan.centre[2] - share * fan.radii[2]
    return {
        ...fan,
        centre: [fan.centre[0], fan.centre[1], foot + share * fan.radii[2] * by],
        radii: scale(fan.radii, by)
    }
}

// Seen from straight above, the figure shows only its mask, lying face up on the ground with
// its feathers spreading above it on the board: the head's centre `lift` above the ground and
// `shift` towards the viewer from the figure's foot, so mask and feathers fit its box.
const FACE_UP = { lift: 4.2, shift: 2.4 }

// The figure with its headdress scaled by `headdress`, standing or lying face up.
function figureWith(headdress: number, faceUp: boolean): Figure {
    const parts: Part[] = [
        { distance: mask, finish: maskFinish },
        HOODED,
        ...(faceUp ? [] : [{ distance: body, finish: bodyFinish }]),
        ...[BACK_FAN, FRONT_FAN].map((row) => {
            const fan = scaledFan(row, headdress)
            return {
                distance: (p: Vec) => featherFan(fan, p),
                finish: (p: Vec) => fanFinish(fan, p)
            }
        })
    ]
    // Lying face up, the figure turns a quarter about its width: its face to the sky, the
    // top of its head away from the viewer.
    const posed = (p: Vec): Vec =>
        faceUp
            ? [
                  p[0] + HEAD.at[0],
                  HEAD.at[1] + p[2] - FACE_UP.lift,
                  HEAD.at[2] + FACE_UP.shift - p[1]
              ]
            : p
    const nearestPart = (p: Vec): { part: Part; distance: number } => {
        let part = parts[0]
        let distance = Infinity
        for (const candidate of parts) {
            const d = candidate.distance(p)
            if (d < distance) {
                distance = d
                part = candidate
            }
        }
        return { part, distance }
    }
    return {
        scene: (p) => Math.max(nearestPart(posed(p)).distance, -p[2]),
        finish: (p) => nearestPart(posed(p)).part.finish(posed(p))
    }
}
