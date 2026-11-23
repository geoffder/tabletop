// The island's paving and the lake round it, seen from straight above in plan units. Only
// scripts/render-looks.mjs runs this, through the /looks page; rerun it after changing either.
import { cellAt, columnOf, isLand, isPalace, isStart, PALACE_CENTRE, rowOf } from '@tabletop/mexica'
import type { Point } from '@tabletop/common'
import { CELL, LAKE_MARGIN } from './view.js'
import { COVE_TOE, SLOPE_WIDTH, type SlopeCorner, type SlopeSide } from './looks.js'
import {
    spillBox,
    type SpillDepth,
    spillFrame,
    type SpillKind,
    spillSlide,
    toPlan
} from './spillShape.js'
import { PLAN, WATERS } from './plan.js'
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

// The board's paving: a pale weathered grey stone, cool enough that the yellow temples and the
// gold tokens stand out on it.
export const PAVING: StoneStyle = {
    light: '#dedbd2',
    dark: '#bdb8aa',
    mortar: '#938d7e',
    palace: '#a3a09a'
}

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

export function renderPaving(style: StoneStyle, pixels = PAVING_PIXELS, box = WATERS): Bitmap {
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
    return paint(box, pixels, (x, y) => {
        const cell = landAt(x, y) ?? nearestLand(x, y, coastReach(x, y))
        if (cell === undefined) return { color: [0, 0, 0], alpha: 0 }
        const [tone, slopeX, slopeY, inset] = draws(cell)
        const edge = coastStoneEdge(
            cell,
            x - columnOf(cell) * CELL - CELL / 2,
            y - rowOf(cell) * CELL - CELL / 2,
            JOINT + inset * 0.6,
            coastReach(x, y)
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

// The island's outer stones run past the grid to an edge that wanders along the coast, so the
// island is not all right angles.
const COAST = { least: 1.5, most: 7.5, corner: 7 }
const coastNoise = fractal(noise2(97), 3)

function coastReach(x: number, y: number): number {
    return (
        (COAST.least + (COAST.most - COAST.least) * coastNoise(x * 0.04, y * 0.04)) *
        edgeFit(x, y) *
        pinchFit(x, y)
    )
}

// While a pinch's patch is drawn, its corner: the island's outer stones are drawn back to the
// grid there, so the two squares' paving meets only at the corner with the shore's rocks packed
// in round it, and reach out as usual from PINCH_FIT.outer on.
let pinched: Point | undefined
const PINCH_FIT = { inner: 1, outer: 16 }
function pinchFit(x: number, y: number): number {
    if (pinched === undefined) return 1
    return smoothstep(PINCH_FIT.inner, PINCH_FIT.outer, Math.hypot(x - pinched.x, y - pinched.y))
}

const PINCH_ROCK = { radius: 4.2, tone: 0.45 }
function pinchRock(at: Point): Rock {
    return { x: at.x, y: at.y, ...PINCH_ROCK }
}

// Runs `draw` with the coast drawn back from a pinch's corner: see pinches.ts.
export function withPinch<T>(at: Point, draw: () => T): T {
    pinched = at
    try {
        return draw()
    } finally {
        pinched = undefined
    }
}

// Past the printed board's edge the lake is only LAKE_MARGIN wide, so the coast and its rocks are
// narrowed towards the edge to end short of the lake's rim; inside, they reach as far as they like.
const RIM_CLEARANCE = 3
function edgeFit(x: number, y: number): number {
    const inside = Math.min(x, y, PLAN.width - x, PLAN.height - y)
    const room = LAKE_MARGIN - RIM_CLEARANCE + Math.max(0, inside)
    return Math.min(1, room / (COAST.most + SHORE.widest))
}

function lakeBeside(cell: number, column: number, row: number): boolean {
    const next = cellAt(columnOf(cell) + column, rowOf(cell) + row)
    return next === undefined || !isLand(next)
}

// How far inside its stone a point lies, round the middle of the stone's cell, and which way its
// nearest edge faces: sides on the lake reach out by `reach`, rounder at the corners.
function coastStoneEdge(
    cell: number,
    px: number,
    py: number,
    joint: number,
    reach: number
): { inside: number; normal: { x: number; y: number } } {
    const open = {
        left: lakeBeside(cell, -1, 0),
        right: lakeBeside(cell, 1, 0),
        up: lakeBeside(cell, 0, -1),
        down: lakeBeside(cell, 0, 1)
    }
    const side = (lake: boolean) => (lake ? CELL / 2 + reach : CELL / 2 - joint)
    const [left, right, up, down] = [open.left, open.right, open.up, open.down].map(side)
    const corner =
        (px < 0 ? open.left : open.right) && (py < 0 ? open.up : open.down) ? COAST.corner : CORNER
    return stoneEdge(
        px - (right - left) / 2,
        py - (down - up) / 2,
        (left + right) / 2,
        (up + down) / 2,
        corner
    )
}

// How far inside a box with rounded corners, half `halfX` by `halfY`, a point lies, and which way
// its nearest edge faces.
function stoneEdge(
    px: number,
    py: number,
    halfX: number,
    halfY: number,
    corner: number
): { inside: number; normal: { x: number; y: number } } {
    const qx = Math.abs(px) - (halfX - corner)
    const qy = Math.abs(py) - (halfY - corner)
    if (qx > 0 && qy > 0) {
        const length = Math.hypot(qx, qy)
        return {
            inside: corner - length,
            normal: { x: (Math.sign(px) * qx) / length, y: (Math.sign(py) * qy) / length }
        }
    }
    if (qx > qy) return { inside: corner - qx, normal: { x: Math.sign(px), y: 0 } }
    return { inside: corner - qy, normal: { x: 0, y: Math.sign(py) } }
}

// The land cell nearest a point outside the grid's land, if one lies within `within`.
function nearestLand(x: number, y: number, within: number): number | undefined {
    const column = Math.floor(x / CELL)
    const row = Math.floor(y / CELL)
    let best: number | undefined
    let nearest = within
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            const cell = cellAt(column + dc, row + dr)
            if (cell === undefined || !isLand(cell)) continue
            const left = (column + dc) * CELL
            const top = (row + dr) * CELL
            const d = Math.hypot(
                Math.max(left - x, 0, x - (left + CELL)),
                Math.max(top - y, 0, y - (top + CELL))
            )
            if (d <= nearest) {
                nearest = d
                best = cell
            }
        }
    }
    return best
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

export function renderLake(style: WaterStyle, pixels = LAKE_PIXELS, box = WATERS): Bitmap {
    const at = water(style)
    return paint(box, pixels, (x, y) => ({
        color: at(
            x,
            y,
            SHORE_SHALLOWS * Math.exp(-Math.max(0, offshore(x, y) - shoreWidth(x, y)) / 24)
        ),
        alpha: 1
    }))
}

// The lake's water at the shore.
const SHORE_SHALLOWS = 0.78
// Canal water is the lake's by the shore, so a canal opens into the lake with no change of
// colour; its sloping banks give it its depth.
const CANAL_SHALLOWS = SHORE_SHALLOWS

export function renderCanal(style: WaterStyle, pixels = LAKE_PIXELS): Bitmap {
    const at = water(style)
    return paint(PLAN, pixels, (x, y) => ({ color: at(x, y, CANAL_SHALLOWS), alpha: 1 }))
}

export const SLOPE_PIXELS = 3
// How round the top of a cove's bank is at the corner of land; its foot rounds by COVE_TOE.
const COVE_TOP_ROUND = 4

// The tezontle bricks facing a canal's sloping banks, in plan, quietened so they sit below the
// paving rather than stand out from it.
const BRICK = { light: '#a27866', dark: '#7a5545', mortar: '#5b473c', wet: '#3c3d36' }
// Wider, gentler banks take more courses of brick and less of the light's slant.
const BRICK_COURSES = Math.max(2, Math.round(SLOPE_WIDTH / 4))
const STEEPNESS = Math.min(1.6, Math.max(0.6, 8 / SLOPE_WIDTH))

type Brick = { joint: number; tone: number }

// The brick at `along` the bank and `across` it, from the kerb (0) to the water (SLOPE_WIDTH),
// in a run of bricks `run` long that starts and ends on a joint.
function brickAt(along: number, across: number, run: number, seed: number): Brick {
    const depth = SLOPE_WIDTH / BRICK_COURSES
    const course = Math.min(BRICK_COURSES - 1, Math.floor(across / depth))
    const next = seededRandom(seed * 97 + course * 13 + 5)
    const offset = course % 2 === 0 ? 0 : 2.5 + next() * 2
    const edges = [0]
    let at = offset
    while (at < run - 2.5) {
        if (at > 0) edges.push(at)
        at += 4.5 + next() * 3
    }
    edges.push(run)
    let index = 0
    while (index < edges.length - 2 && edges[index + 1] <= along) index++
    const toEdge = Math.min(along - edges[index], edges[index + 1] - along)
    const toCourse = Math.min(across - course * depth, (course + 1) * depth - across)
    const joint = clamp(1 - Math.min(toEdge, toCourse) / 0.3)
    return { joint, tone: seededRandom(seed * 389 + course * 31 + index * 7 + 1)() }
}

function brickColor(brick: Brick, across: number, facing: number, mottle: number): Rgb {
    const [light, dark, mortar, wet] = [BRICK.light, BRICK.dark, BRICK.mortar, BRICK.wet].map(
        linear
    )
    let color = mix(light, dark, clamp(0.2 + brick.tone * 0.55 + (mottle - 0.5) * 0.3))
    color = mix(color, mortar, brick.joint * 0.75)
    color = mix(color, facing > 0 ? [1, 1, 1] : [0, 0, 0], Math.abs(facing) * 0.14 * STEEPNESS)
    color = mix(color, [1, 1, 1], (1 - smoothstep(0, 1.5, across)) * 0.12)
    return mix(color, wet, smoothstep(0.6, 1, across / SLOPE_WIDTH) * 0.5)
}

// The sloping bank on one side of a canal, as a tile one cell along it; it slopes down away from
// the kerb, and is lit by which way it faces as the paving is.
export function renderSlope(side: SlopeSide, pixels = SLOPE_PIXELS): Bitmap {
    const mottle = fractal(noise2(71), 3)
    const runs = side === 'n' || side === 's'
    const box = runs
        ? { x: 0, y: 0, width: CELL, height: SLOPE_WIDTH }
        : { x: 0, y: 0, width: SLOPE_WIDTH, height: CELL }
    const down = { n: [0, 1], s: [0, -1], w: [1, 0], e: [-1, 0] }[side]
    const facing = down[0] * LIGHT_2D.x + down[1] * LIGHT_2D.y
    return paint(box, pixels, (x, y) => {
        const along = runs ? x : y
        const across = { n: y, s: SLOPE_WIDTH - y, w: x, e: SLOPE_WIDTH - x }[side]
        const brick = brickAt(along, across, CELL, 1)
        return { color: brickColor(brick, across, facing, mottle(x * 0.4, y * 0.4)), alpha: 1 }
    })
}

// Where two of a canal's banks meet in an inside corner, the bank bends round it as a cove: its
// foot rounds in a quarter circle at the water, while its top keeps closer to the square corner
// of land, so the courses between tighten from the foot up. What little corner the top leaves is
// filled as the kerb. The corner of land lies at the tile's corner named.
export function renderSlopeCove(corner: SlopeCorner, pixels = SLOPE_PIXELS): Bitmap {
    const mottle = fractal(noise2(77), 3)
    const kerb = linear('#a88676')
    const size = SLOPE_WIDTH + COVE_TOE
    // Distances from the corner of the tile across from the corner of land.
    const cx = corner === 'ne' || corner === 'se' ? 0 : size
    const cy = corner === 'se' || corner === 'sw' ? 0 : size
    const sx = cx === 0 ? 1 : -1
    const sy = cy === 0 ? 1 : -1
    const step = 1 / pixels
    // The bank's course `t` of the way down, from its top (0) to its foot (1): a square of the
    // given half size with its corner rounded.
    const course = (t: number) => {
        const level = size - t * SLOPE_WIDTH
        const round = COVE_TOP_ROUND + t * (COVE_TOE - COVE_TOP_ROUND)
        return { level, round, straight: level - round }
    }
    // How far outside a course a point lies.
    const outside = (a: number, b: number, t: number) => {
        const { round, straight } = course(t)
        const da = a - straight
        const db = b - straight
        return Math.hypot(Math.max(da, 0), Math.max(db, 0)) + Math.min(Math.max(da, db), 0) - round
    }
    return paint({ x: 0, y: 0, width: size, height: size }, pixels, (x, y) => {
        const a = Math.abs(x - cx)
        const b = Math.abs(y - cy)
        const pastTop = outside(a, b, 0)
        const intoWater = -outside(a, b, 1)
        const water = clamp(intoWater / step + 0.5)
        if (water >= 1) return { color: [0, 0, 0], alpha: 0 }
        let t = 0
        if (pastTop < 0) {
            let low = 0
            let high = 1
            for (let i = 0; i < 18; i++) {
                const mid = (low + high) / 2
                if (outside(a, b, mid) < 0) low = mid
                else high = mid
            }
            t = intoWater > 0 ? 1 : (low + high) / 2
        }
        const across = t * SLOPE_WIDTH
        const { round, straight } = course(t)
        const run = 2 * straight + (Math.PI / 2) * round
        const along =
            b <= straight
                ? b
                : a <= straight
                  ? run - a
                  : straight + Math.atan2(b - straight, a - straight) * round
        const brick = brickAt(along, across, Math.max(run, 1), 9)
        // Down the slope is inwards, away from the course's edge.
        const [na, nb] =
            b <= straight
                ? [1, 0]
                : a <= straight
                  ? [0, 1]
                  : [a - straight, b - straight].map((v) => v / Math.max(1e-6, round))
        const facing = -na * sx * LIGHT_2D.x - nb * sy * LIGHT_2D.y
        const slope = brickColor(brick, across, facing, mottle(x * 0.4, y * 0.4))
        return { color: mix(slope, kerb, clamp(pastTop / step + 0.5)), alpha: 1 - water }
    })
}

// Where a canal turns round a corner of land, its bank curves round the corner: a quarter of a
// ring of bricks round the corner, which lies at the tile's corner named.
export function renderSlopeCorner(corner: SlopeCorner, pixels = SLOPE_PIXELS): Bitmap {
    const mottle = fractal(noise2(73), 3)
    const cx = corner === 'ne' || corner === 'se' ? SLOPE_WIDTH : 0
    const cy = corner === 'se' || corner === 'sw' ? SLOPE_WIDTH : 0
    const step = 1 / pixels
    return paint({ x: 0, y: 0, width: SLOPE_WIDTH, height: SLOPE_WIDTH }, pixels, (x, y) => {
        const dx = x - cx
        const dy = y - cy
        const r = Math.hypot(dx, dy)
        const alpha = clamp((SLOPE_WIDTH - r) / step + 0.5)
        if (alpha <= 0) return { color: [0, 0, 0], alpha: 0 }
        const angle = Math.atan2(Math.abs(dy), Math.abs(dx))
        const brick = brickAt(angle * Math.max(r, 2), r, (Math.PI / 2) * Math.max(r, 2), 3)
        const facing = r > 0 ? (dx / r) * LIGHT_2D.x + (dy / r) * LIGHT_2D.y : 0
        return { color: brickColor(brick, r, facing, mottle(x * 0.4, y * 0.4)), alpha }
    })
}

export const SHORE_PIXELS = 2

// The island's natural shore, in plan: a bank of rough rocks of uneven width standing out from
// the island's edge into the lake, packed in earth, in the shade of the paving above them, wet
// and dark further out, and the odd clump of reeds in the shallows.
const SHORE = { spacing: 4.4, narrowest: 4, widest: 12, reeds: 0.3 }
const ROCK = {
    light: '#c2b6a0',
    dark: '#5e574b',
    earth: '#5a5040',
    reed: '#7b8a45',
    reedDark: '#4d5a2c'
}

type Rock = { x: number; y: number; radius: number; tone: number }

const shoreReach = fractal(noise2(83), 3)

// How far out from the grid's edge the island's stones and the rocks beyond them reach.
export function shoreDepth(x: number, y: number): number {
    return coastReach(x, y) + shoreWidth(x, y)
}

// No further than this.
export const SHORE_ZONE = COAST.most + SHORE.widest * 1.5 + 1

function shoreWidth(x: number, y: number): number {
    return (
        (SHORE.narrowest + (SHORE.widest - SHORE.narrowest) * shoreReach(x * 0.035, y * 0.035)) *
        edgeFit(x, y)
    )
}

// How far a point lies out from the island's wandering edge, not the grid's.
function offshore(x: number, y: number): number {
    return distanceToLand(x, y) - coastReach(x, y)
}

export function renderShore(pixels = SHORE_PIXELS, box = WATERS): Bitmap {
    const [light, dark, earth, reed, reedDark] = [
        ROCK.light,
        ROCK.dark,
        ROCK.earth,
        ROCK.reed,
        ROCK.reedDark
    ].map(linear)
    const wetTint = linear(TURQUOISE.deep)
    const grit = noise2(89)
    const lumps = fractal(noise2(91), 2)
    const width = shoreWidth
    const rocks = new Map<string, Rock | undefined>()
    const rockIn = (column: number, row: number): Rock | undefined => {
        const key = `${column},${row}`
        if (rocks.has(key)) return rocks.get(key)
        const next = seededRandom((column + 500) * 7919 + row * 104729)
        const x = (column + 0.15 + next() * 0.7) * SHORE.spacing
        const y = (row + 0.15 + next() * 0.7) * SHORE.spacing
        const off = offshore(x, y)
        const band = width(x, y)
        const rock =
            off > -1.5 && off < band
                ? {
                      x,
                      y,
                      radius: SHORE.spacing * (0.55 + next() * 0.4) * (1.15 - (off / band) * 0.45),
                      tone: next()
                  }
                : undefined
        rocks.set(key, rock)
        return rock
    }
    const clump = (x: number, y: number): { amount: number; tone: number } => {
        const size = 12
        const column = Math.floor(x / size)
        const row = Math.floor(y / size)
        const next = seededRandom((column + 300) * 6151 + row * 31337)
        if (next() > SHORE.reeds) return { amount: 0, tone: 0 }
        const cx = (column + 0.25 + next() * 0.5) * size
        const cy = (row + 0.25 + next() * 0.5) * size
        const off = offshore(cx, cy)
        const band = width(cx, cy)
        if (off < band * 0.7 || off > band * 1.4) return { amount: 0, tone: 0 }
        const dx = x - cx
        const dy = y - cy
        const r = Math.hypot(dx, dy)
        const radius = 3.6
        if (r > radius) return { amount: 0, tone: 0 }
        const angle = Math.atan2(dy, dx)
        const blades =
            Math.abs(Math.sin(angle * 6 + next() * 6)) * Math.abs(Math.sin(angle * 4.3 + 1))
        return {
            amount: smoothstep(0.35, 0.8, blades) * (1 - r / radius) ** 0.6 + (r < 1.1 ? 0.8 : 0),
            tone: 0.5 + 0.5 * Math.sin(angle * 9)
        }
    }
    return paint(box, pixels, (x, y) => {
        const off = offshore(x, y)
        if (off < -1.5 || off > SHORE.widest * 1.5) return { color: [0, 0, 0], alpha: 0 }
        const band = width(x, y)
        const column = Math.floor(x / SHORE.spacing)
        const row = Math.floor(y / SHORE.spacing)
        let top: { height: number; nx: number; ny: number; rim: number; tone: number } | undefined
        const lump = (lumps(x * 0.45, y * 0.45) - 0.5) * 0.55
        // At a pinch, one more rock sits on the corner itself, so no lake shows between the two
        // squares' kerbs there.
        const candidates = [-1, 0, 1].flatMap((dr) =>
            [-1, 0, 1].map((dc) => rockIn(column + dc, row + dr))
        )
        if (pinched !== undefined) candidates.push(pinchRock(pinched))
        for (const rock of candidates) {
            if (rock === undefined) continue
            const radius = rock.radius * (1 + lump)
            const dx = (x - rock.x) / radius
            const dy = (y - rock.y) / radius
            const r2 = dx * dx + dy * dy
            if (r2 >= 1) continue
            const height = (1 - r2) ** 0.6 * radius
            if (top === undefined || height > top.height) {
                top = { height, nx: dx, ny: dy, rim: Math.sqrt(r2), tone: rock.tone }
            }
        }
        // The paving stands above the bank and shades its inner edge.
        const shaded = 1 - 0.45 * (1 - smoothstep(-1.5, 2.5, off))
        const wet = smoothstep(0.45, 1, off / band)
        const sedge = clump(x, y)
        if (top !== undefined) {
            const steep = (1.7 * top.rim) / Math.sqrt(1 - top.rim * top.rim + 0.08)
            const nx = top.nx * steep
            const ny = top.ny * steep
            const length = Math.hypot(nx, ny, 1)
            const facing = (-nx * LIGHT_2D.x - ny * LIGHT_2D.y) / length
            const lit = clamp(0.42 + facing * 0.55 + (1 / length) * 0.15)
            let color = mix(dark, light, clamp(lit * (0.7 + top.tone * 0.45)))
            color = mix(color, earth, (grit(x * 1.3, y * 1.3) - 0.5) * 0.25 + 0.05)
            // Gaps between the rocks fall into shadow.
            color = mix(color, [0, 0, 0], smoothstep(0.7, 1, top.rim) * 0.35)
            color = mix(color, mix(color, wetTint, 0.35), wet)
            color = mix(color, [0, 0, 0], wet * 0.2)
            color = mix(color, [0, 0, 0], 1 - shaded)
            if (sedge.amount > 0)
                color = mix(color, mix(reedDark, reed, sedge.tone), clamp(sedge.amount))
            return { color, alpha: 1 }
        }
        const ground = 1 - smoothstep(band * 0.6, band * 1.0, off)
        const color = mix(
            earth,
            [0, 0, 0],
            (grit(x * 0.9, y * 0.9) - 0.5) * 0.25 + 0.1 + (1 - shaded)
        )
        if (sedge.amount > 0) {
            return {
                color: mix(reedDark, reed, sedge.tone),
                alpha: Math.max(ground, clamp(sedge.amount))
            }
        }
        return { color, alpha: ground }
    })
}

// A rock slide where a stretch of shore is cut short beside a canal's bank, round the corner of
// land where the shore ends (board/spillShape.ts lays it out), lit as the shore's rocks are:
// higher rocks lie over lower ones, all bedded in earth, their tones mixed as the shore's are.
const SLIDE_HEIGHT = 6

export function renderSpill(
    out: SlopeSide,
    end: SlopeSide,
    kind: SpillKind,
    depth: SpillDepth,
    pixels = SLOPE_PIXELS
): Bitmap {
    const [light, dark, earth] = [ROCK.light, ROCK.dark, ROCK.earth].map(linear)
    const grit = noise2(97 + depth)
    const lumps = fractal(noise2(101 + depth), 2)
    const frame = spillFrame(out, end)
    const slide = spillSlide(kind, depth)
    const rocks = slide.rocks.map((rock) => ({
        ...toPlan(frame, rock.u, rock.v),
        radius: rock.radius,
        tone: rock.tone,
        height: rock.height
    }))
    // Back from plan into the slide's frame: the frame's axes are a quarter turn apart.
    const inFrame = (x: number, y: number) => ({
        u: x * frame.end.x + y * frame.end.y,
        v: x * frame.out.x + y * frame.out.y
    })
    return paint(spillBox(out, end, kind, depth), pixels, (x, y) => {
        const lump = (lumps(x * 0.45, y * 0.45) - 0.5) * 0.45
        let top: { height: number; nx: number; ny: number; rim: number; tone: number } | undefined
        for (const rock of rocks) {
            const radius = rock.radius * (1 + lump)
            const dx = (x - rock.x) / radius
            const dy = (y - rock.y) / radius
            const r2 = dx * dx + dy * dy
            if (r2 >= 1) continue
            const height = rock.height * SLIDE_HEIGHT + (1 - r2) ** 0.6 * radius
            if (top === undefined || height > top.height) {
                top = {
                    height,
                    nx: dx,
                    ny: dy,
                    rim: Math.sqrt(r2),
                    tone: rock.tone
                }
            }
        }
        const { u, v } = inFrame(x, y)
        const bed = slide.cover(u, v)
        let ground = mix(mix(earth, dark, 0.5), [0, 0, 0], (grit(x * 0.9, y * 0.9) - 0.5) * 0.25)
        if (top === undefined) return { color: ground, alpha: bed }
        const steep = (1.7 * top.rim) / Math.sqrt(1 - top.rim * top.rim + 0.08)
        const nx = top.nx * steep
        const ny = top.ny * steep
        const length = Math.hypot(nx, ny, 1)
        const facing = (-nx * LIGHT_2D.x - ny * LIGHT_2D.y) / length
        const lit = clamp(0.42 + facing * 0.55 + (1 / length) * 0.15)
        let color = mix(dark, light, clamp(lit * (0.7 + top.tone * 0.45)))
        color = mix(color, earth, (grit(x * 1.3, y * 1.3) - 0.5) * 0.25 + 0.05)
        color = mix(color, [0, 0, 0], smoothstep(0.7, 1, top.rim) * 0.35)
        // Each rock's edge settles into the bed beneath it, or the water beyond.
        const solid = clamp((1 - top.rim) * 12)
        ground = mix(ground, color, solid)
        return { color: ground, alpha: Math.max(bed, solid) }
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
