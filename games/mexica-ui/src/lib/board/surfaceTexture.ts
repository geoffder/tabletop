// The island's paving and the lake round it, seen from straight above in plan units. Only
// scripts/render-looks.mjs runs this, through the /looks page; rerun it after changing either.
import { cellAt, columnOf, isLand, isPalace, isStart, PALACE_CENTRE, rowOf } from '@tabletop/mexica'
import { CELL } from './view.js'
import { PLAN } from './plan.js'
import {
    type Bitmap,
    clamp,
    fractal,
    linear,
    mix,
    noise2,
    paint,
    type Rgb,
    smoothstep
} from './light.js'
import { seededRandom } from './random.js'

export const PAVING_PIXELS = 2
export const LAKE_PIXELS = 1

export type StoneStyle = { light: string; dark: string; mortar: string; palace: string }

// Limestone is the board's paving; the warmer stones are kept to compare against the temples.
export const STONES = {
    limestone: { light: '#ece5d2', dark: '#cfc4a8', mortar: '#a69a80', palace: '#a9a59b' },
    warm25: { light: '#ece0c6', dark: '#cfbe9c', mortar: '#a49476', palace: '#aca597' },
    warm45: { light: '#ebdcbd', dark: '#cfba92', mortar: '#a28e6e', palace: '#aea594' },
    warm65: { light: '#ebd9b4', dark: '#cfb689', mortar: '#a08967', palace: '#b0a591' },
    sandstone: { light: '#ead2a4', dark: '#cfae78', mortar: '#9c8059', palace: '#b4a58c' }
} satisfies Record<string, StoneStyle>

export type WaterStyle = { deep: string; open: string; shallow: string }

export const TURQUOISE: WaterStyle = { deep: '#1b7391', open: '#2a92ab', shallow: '#5cc0c2' }

const JOINT = 1.3
const CORNER = 3.5
const BEVEL = 3.2
const LIGHT_2D = { x: -0.6, y: -0.8 }

function landAt(x: number, y: number): number | undefined {
    const cell = cellAt(Math.floor(x / CELL), Math.floor(y / CELL))
    return cell !== undefined && isLand(cell) ? cell : undefined
}

export function renderPaving(style: StoneStyle, pixels = PAVING_PIXELS): Bitmap {
    const [light, dark, mortar, palace] = [style.light, style.dark, style.mortar, style.palace].map(
        linear
    )
    const mottle = fractal(noise2(11), 4)
    const grain = noise2(23)
    const wobble = fractal(noise2(31), 2)
    const stains = fractal(noise2(37), 3)
    const random = new Map<number, number[]>()
    const draws = (cell: number) => {
        let values = random.get(cell)
        if (values === undefined) {
            const next = seededRandom(cell * 7919 + 3)
            values = [next(), next(), next(), next()]
            random.set(cell, values)
        }
        return values
    }
    return paint(PLAN, pixels, (x, y) => {
        const cell = landAt(x, y)
        if (cell === undefined) return { color: [0, 0, 0], alpha: 0 }
        const [tone, slopeX, slopeY, inset] = draws(cell)
        const edge = stoneEdge(
            x - columnOf(cell) * CELL - CELL / 2,
            y - rowOf(cell) * CELL - CELL / 2,
            JOINT + inset * 0.6
        )
        const inside = edge.inside + (wobble(x * 0.22, y * 0.22) - 0.5) * 1.6
        const base: Rgb = isPalace(cell)
            ? mix(palace, dark, isStart(cell) ? 0.3 : 0)
            : mix(light, dark, 0.1 + tone * 0.6)
        if (inside < 0) {
            const recess = smoothstep(0, -JOINT, inside)
            const joint = mix(
                mortar,
                [0, 0, 0],
                0.18 + recess * 0.12 + (grain(x * 1.4, y * 1.4) - 0.5) * 0.2
            )
            return { color: joint, alpha: 1 }
        }
        const fx = x - columnOf(cell) * CELL
        const fy = y - rowOf(cell) * CELL
        let shade =
            (mottle(x * 0.05, y * 0.05) - 0.5) * 0.4 +
            (grain(x * 0.8, y * 0.8) - 0.5) * 0.12 +
            ((fx / CELL - 0.5) * (slopeX - 0.5) + (fy / CELL - 0.5) * (slopeY - 0.5)) * 0.25
        shade -= smoothstep(0.62, 0.8, stains(x * 0.08 + cell, y * 0.08)) * 0.25
        const round = 1 - smoothstep(0, BEVEL, inside)
        shade += (edge.normal.x * LIGHT_2D.x + edge.normal.y * LIGHT_2D.y) * round * 0.55
        shade -= round * 0.08
        if (cell === PALACE_CENTRE) shade -= carving(fx - CELL / 2, fy - CELL / 2)
        return {
            color: mix(
                base,
                shade > 0 ? [1, 1, 1] : [0, 0, 0],
                Math.min(0.9, Math.abs(shade) * 0.6)
            ),
            alpha: 1
        }
    })
}

// How far inside a stone with rounded corners a point lies, and which way its nearest edge faces.
function stoneEdge(
    px: number,
    py: number,
    joint: number
): { inside: number; normal: { x: number; y: number } } {
    const half = CELL / 2 - joint - CORNER
    const qx = Math.abs(px) - half
    const qy = Math.abs(py) - half
    if (qx > 0 && qy > 0) {
        const length = Math.hypot(qx, qy)
        return {
            inside: CORNER - length,
            normal: { x: (Math.sign(px) * qx) / length, y: (Math.sign(py) * qy) / length }
        }
    }
    if (qx > qy) return { inside: CORNER - qx, normal: { x: Math.sign(px), y: 0 } }
    return { inside: CORNER - qy, normal: { x: 0, y: Math.sign(py) } }
}

// A sun disc cut into the palace's middle stone: a ring, a disc and short rays between them.
function carving(dx: number, dy: number): number {
    const r = Math.hypot(dx, dy)
    const groove = (at: number, width: number) => Math.exp(-(((r - at) / width) ** 2))
    const angle = Math.atan2(dy, dx)
    const rays = r > 6 && r < 11 ? Math.max(0, Math.cos(angle * 8)) ** 6 * 0.6 : 0
    return clamp(groove(13, 1.1) * 0.55 + groove(5.5, 1) * 0.5 + rays * 0.45)
}

// Water lighter towards the shore, `shallows` from 0 out in the lake to 1 at its edge, under
// a swell and slow waves that run on unbroken from the lake into the canals.
function water(style: WaterStyle): (x: number, y: number, shallows: number) => Rgb {
    const [deep, open, shallow] = [style.deep, style.open, style.shallow].map(linear)
    const swell = fractal(noise2(5), 4)
    const warp = fractal(noise2(41), 3)
    return (x, y, shallows) => {
        let color = mix(mix(deep, open, swell(x * 0.01, y * 0.01)), shallow, shallows * 0.8)
        const bend = (warp(x * 0.015, y * 0.015) - 0.5) * 10
        const wave = Math.sin(y * 0.12 + x * 0.02 + bend)
        color = mix(color, [1, 1, 1], smoothstep(0.7, 1, wave) * 0.03)
        return mix(color, [0, 0, 0], smoothstep(-0.7, -1, wave) * 0.03)
    }
}

export function renderLake(style: WaterStyle, pixels = LAKE_PIXELS): Bitmap {
    const at = water(style)
    return paint(PLAN, pixels, (x, y) => ({
        color: at(x, y, CANAL_SHALLOWS * Math.exp(-distanceToLand(x, y) / 24)),
        alpha: 1
    }))
}

// Canal water is the lake's water at the shore, so a canal opens into the lake with no change
// of colour.
const CANAL_SHALLOWS = 0.78

export function renderCanal(style: WaterStyle, pixels = LAKE_PIXELS): Bitmap {
    const at = water(style)
    return paint(PLAN, pixels, (x, y) => ({ color: at(x, y, CANAL_SHALLOWS), alpha: 1 }))
}

export const WALL_PIXELS = 3

// A stretch of the stone wall below a bank, one cell long and `height` tall on screen: two
// courses of blocks of uneven length, the face in the shade of the light from beyond, a lit lip
// along the top and a wet line where it meets the water.
export function renderWall(
    variant: number,
    height: number,
    style: StoneStyle,
    pixels = WALL_PIXELS
): Bitmap {
    const [light, dark, mortar] = [style.light, style.dark, style.mortar].map(linear)
    const wet = linear('#34423a')
    const mottle = fractal(noise2(61 + variant), 3)
    const courses = 2
    const starts = Array.from({ length: courses }, (_, course) => {
        const next = seededRandom(variant * 97 + course * 13 + 5)
        const edges = [-next() * 6]
        while (edges[edges.length - 1] < CELL) edges.push(edges[edges.length - 1] + 7 + next() * 7)
        return edges
    })
    const tones = (course: number, block: number) =>
        seededRandom(variant * 389 + course * 31 + block * 7 + 1)()
    return paint({ x: 0, y: 0, width: CELL, height }, pixels, (x, y) => {
        const t = y / height
        const course = Math.min(courses - 1, Math.floor(t * courses))
        const edges = starts[course]
        let block = 0
        while (edges[block + 1] <= x) block++
        const toEdge = Math.min(x - edges[block], edges[block + 1] - x)
        const toCourse = Math.abs(t * courses - Math.round(t * courses)) * (height / courses)
        const joint = clamp(1 - Math.min(toEdge, course === 0 && t < 0.5 ? 9 : toCourse) / 0.35)
        const tone = 0.25 + tones(course, block) * 0.5 + (mottle(x * 0.3, y * 0.3) - 0.5) * 0.3
        let color = mix(mix(light, dark, clamp(tone)), mortar, joint * 0.8)
        color = mix(color, [0, 0, 0], 0.5)
        color = mix(color, light, (1 - smoothstep(0, 0.6, y)) * 0.7)
        color = mix(color, wet, smoothstep(0.7, 1, t) * 0.75)
        return { color, alpha: 1 }
    })
}

function distanceToLand(x: number, y: number): number {
    const column = Math.floor(x / CELL)
    const row = Math.floor(y / CELL)
    let nearest = 3 * CELL
    for (let dr = -3; dr <= 3; dr++) {
        for (let dc = -3; dc <= 3; dc++) {
            const cell = cellAt(column + dc, row + dr)
            if (cell === undefined || !isLand(cell)) continue
            const left = (column + dc) * CELL
            const top = (row + dr) * CELL
            const nx = Math.max(left - x, 0, x - (left + CELL))
            const ny = Math.max(top - y, 0, y - (top + CELL))
            nearest = Math.min(nearest, Math.hypot(nx, ny))
        }
    }
    return nearest
}
