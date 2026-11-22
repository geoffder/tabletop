// A dugout canoe, modelled in the round and drawn for the way it heads: walls rising from the
// water to a rim that sweeps up at bow and stern, a hollow with a floor, and two thwarts. Each
// face is lit by its slope and the faces are painted far to near.
//
// Model coordinates run x along the canoe, y across it and z up from the waterline, in units
// `SCALE` times smaller than the board's. A heading is the canoe's angle on the board's ground
// before the view's tilt, as the board turns the ride's course into it.

export type CanoeFace = { d: string; fill: string }
// `front` is the wall and rim nearer the viewer than the canoe's middle, drawn again over a
// Pilli Mexica standing in it, and `aboard` the outline a figure standing in it is clipped to:
// whatever stands above the rim, and below it only what is over the hollow, so nothing of it
// shows through the walls or under the hull.
export type CanoeDrawing = {
    shadow: string
    faces: readonly CanoeFace[]
    front: readonly CanoeFace[]
    aboard: string
}

type Vec = readonly [number, number, number]
type Kind = 'outer' | 'inner' | 'rim' | 'floor' | 'thwart'
type Face = { points: readonly Vec[]; kind: Kind }

const SCALE = 1.45
const HALF_LENGTH = 23
const HALF_BEAM = 7.5
// How long the beam holds toward the ends; higher is fuller.
const FULLNESS = 2.2
const HEIGHT = 3.2
// How much higher the rim stands at the very ends, and how sharply it sweeps up.
const SHEER = 6
const SHEER_POWER = 2.6
const WALL = 1.1
const FLOOR = 0.6
const WATERLINE = 0.9
const THWARTS = [-0.4, 0.4]
const SEGMENTS = 18

const COLOURS: Record<Kind, readonly [number, number, number]> = {
    outer: [138, 90, 50],
    inner: [94, 59, 31],
    floor: [94, 59, 31],
    rim: [176, 124, 70],
    thwart: [176, 124, 70]
}
const DARK: Vec = [20, 12, 6]
// Light from the upper left, toward the viewer.
const LIGHT = normalise([-0.45, -0.55, 0.9])
// Shading: the darkest a face turned from the light goes, and how much light brightens it.
const SHADE = { least: 0.62, light: 0.55 }
// Faces nearly level with each other are painted in this order where their depths tie.
const LAYER: Record<Kind, number> = { floor: -3, inner: -2, outer: 0, rim: 0.1, thwart: 0.2 }
// How far the shadow falls across the water from the hull, in board units.
const SHADOW_FALL = 2.5
// Past the tallest figure, in board units: how far the clip for a figure aboard reaches.
const ABOARD_REACH = 400

function subtract(a: Vec, b: Vec): Vec {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

function cross(a: Vec, b: Vec): Vec {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

function dot(a: Vec, b: Vec): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function normalise(a: Vec): Vec {
    const length = Math.hypot(a[0], a[1], a[2]) || 1
    return [a[0] / length, a[1] / length, a[2] / length]
}

function mix(a: Vec, b: Vec, t: number): string {
    const channel = (i: number) => Math.round(a[i] + (b[i] - a[i]) * t)
    return `rgb(${channel(0)} ${channel(1)} ${channel(2)})`
}

// Round the hull at each station along it: the rim outside and in, the waterline and the
// floor's edge, each on both sides.
type Station = { outer: Vec[]; inner: Vec[]; water: Vec[]; floor: Vec[] }

function stations(): Station[] {
    return Array.from({ length: SEGMENTS + 1 }, (_, i) => {
        const s = -1 + (2 * i) / SEGMENTS
        const along = s * HALF_LENGTH
        const beam = HALF_BEAM * Math.max(0, 1 - Math.abs(s) ** FULLNESS) ** 0.55
        const height = HEIGHT + SHEER * Math.abs(s) ** SHEER_POWER
        const inside = Math.max(0, beam - WALL)
        const water = Math.abs(s) > 0.999 ? 0 : beam * WATERLINE
        const sides = [1, -1]
        return {
            outer: sides.map((side): Vec => [along, side * beam, height]),
            inner: sides.map((side): Vec => [along * 0.985, side * inside, height]),
            water: sides.map((side): Vec => [along * 0.94, side * water, 0]),
            floor: sides.map((side): Vec => [along * 0.93, side * inside * 0.7, FLOOR])
        }
    })
}

const STATIONS = stations()

// Every face, wound so its normal points out of the wood: away from the keel line outside,
// toward it inside, and up for the rim, floor and thwarts.
const FACES: readonly Face[] = (() => {
    const faces: Face[] = []
    const add = (points: Vec[], kind: Kind) => {
        const centre = points.reduce<Vec>(
            (sum, p) => [sum[0] + p[0], sum[1] + p[1], sum[2] + p[2]],
            [0, 0, 0]
        )
        const normal = cross(subtract(points[1], points[0]), subtract(points[2], points[0]))
        const away: Vec = [centre[0] * 0.12, centre[1], 0]
        const outward =
            kind === 'outer' ? dot(normal, away) : kind === 'inner' ? -dot(normal, away) : normal[2]
        faces.push({ points: outward < 0 ? points.reverse() : points, kind })
    }
    for (let i = 0; i < SEGMENTS; i++) {
        const [a, b] = [STATIONS[i], STATIONS[i + 1]]
        for (const k of [0, 1]) {
            add([a.water[k], b.water[k], b.outer[k], a.outer[k]], 'outer')
            add([a.floor[k], b.floor[k], b.inner[k], a.inner[k]], 'inner')
            add([a.inner[k], b.inner[k], b.outer[k], a.outer[k]], 'rim')
        }
        add([a.floor[0], b.floor[0], b.floor[1], a.floor[1]], 'floor')
    }
    for (const at of THWARTS) {
        const station = STATIONS[Math.round(((at + 1) / 2) * SEGMENTS)]
        const [x, y, z] = station.inner[0]
        const board = 1.1
        add(
            [
                [x - board, -y, z - 0.4],
                [x + board, -y, z - 0.4],
                [x + board, y, z - 0.4],
                [x - board, y, z - 0.4]
            ],
            'thwart'
        )
    }
    return faces
})()

type Flat = readonly [number, number]

function path(points: readonly Flat[]): string {
    return `M${points.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join('L')}Z`
}

// Wound one way round, so outlines laid over each other add up under the nonzero rule.
function clockwise(points: Flat[]): Flat[] {
    let twice = 0
    points.forEach(([x, y], i) => {
        const [nx, ny] = points[(i + 1) % points.length]
        twice += x * ny - nx * y
    })
    return twice < 0 ? points.reverse() : points
}

// The hollow swept straight up the screen, and everything above the rim's height at the
// canoe's middle, where a figure standing there is clear of the walls.
function aboardOutline(hollow: readonly Flat[], rimTop: number): string {
    const up = ([x, y]: Flat): Flat => [x, y - ABOARD_REACH]
    const above: Flat[] = [
        [-ABOARD_REACH, -ABOARD_REACH],
        [ABOARD_REACH, -ABOARD_REACH],
        [ABOARD_REACH, rimTop],
        [-ABOARD_REACH, rimTop]
    ]
    const sweeps = hollow.map((point, i) => {
        const next = hollow[(i + 1) % hollow.length]
        return clockwise([point, next, up(next), up(point)])
    })
    return [clockwise(above), clockwise([...hollow]), ...sweeps].map(path).join('')
}

function draw(heading: number, tilt: number): CanoeDrawing {
    const rise = Math.sqrt(1 - tilt * tilt)
    // Toward the viewer, who looks from the near side of the table.
    const view: Vec = [0, rise, tilt]
    const [cos, sin] = [Math.cos(heading), Math.sin(heading)]
    const turn = ([x, y, z]: Vec): Vec => [
        (x * cos - y * sin) * SCALE,
        (x * sin + y * cos) * SCALE,
        z * SCALE
    ]
    const onScreen = ([x, y, z]: Vec): Flat => [x, y * tilt - z * rise]
    const faces: (CanoeFace & { depth: number; near: boolean })[] = []
    for (const { points, kind } of FACES) {
        const turned = points.map(turn)
        const normal = normalise(
            cross(subtract(turned[1], turned[0]), subtract(turned[2], turned[0]))
        )
        if (kind !== 'thwart' && dot(normal, view) <= 1e-4) continue
        const centre = turned.reduce<Vec>(
            (sum, p) => [
                sum[0] + p[0] / turned.length,
                sum[1] + p[1] / turned.length,
                sum[2] + p[2] / turned.length
            ],
            [0, 0, 0]
        )
        const shade =
            kind === 'thwart'
                ? 1
                : Math.min(1, SHADE.least + SHADE.light * Math.max(0, dot(normal, LIGHT)))
        faces.push({
            depth: dot(centre, view) + LAYER[kind],
            near: (kind === 'outer' || kind === 'rim') && dot(centre, view) > 0,
            d: path(turned.map(onScreen)),
            fill: mix(COLOURS[kind], DARK, 1 - shade)
        })
    }
    // The opening, filled behind everything, so no water shows where faces meet.
    const opening = [
        ...STATIONS.map((station) => station.inner[0]),
        ...STATIONS.slice()
            .reverse()
            .map((station) => station.inner[1])
    ]
    const hollow = opening.map(turn).map(onScreen)
    faces.push({
        depth: -Infinity,
        near: false,
        d: path(hollow),
        fill: mix(COLOURS.inner, DARK, 0.3)
    })
    faces.sort((a, b) => a.depth - b.depth)
    const waterline = [
        ...STATIONS.map((station) => station.water[0]),
        ...STATIONS.slice()
            .reverse()
            .map((station) => station.water[1])
    ]
    const shadow = path(
        waterline.map(turn).map(([x, y]): Flat => [x + SHADOW_FALL, y * tilt + SHADOW_FALL])
    )
    const face = ({ d, fill }: CanoeFace) => ({ d, fill })
    return {
        shadow,
        faces: faces.map(face),
        front: faces.filter((each) => each.near).map(face),
        aboard: aboardOutline(hollow, -HEIGHT * SCALE * rise)
    }
}

// Drawings by whole degree of heading and the view's tilt: a turn redraws the canoe only as
// often as it turns another degree.
const drawings = new Map<string, CanoeDrawing>()

export function canoe(heading: number, tilt: number): CanoeDrawing {
    const degree = ((Math.round((heading * 180) / Math.PI) % 360) + 360) % 360
    const key = `${degree}:${tilt}`
    let drawing = drawings.get(key)
    if (drawing === undefined) {
        drawing = draw((degree * Math.PI) / 180, tilt)
        drawings.set(key, drawing)
    }
    return drawing
}
