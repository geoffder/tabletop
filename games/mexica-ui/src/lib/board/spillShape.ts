import type { Point } from '@tabletop/common'
import { clamp, smoothstep } from './light.js'
import { seededRandom } from './random.js'
import { SLOPE_WIDTH, type SlopeSide } from './looks.js'
import type { Box } from './view.js'

// A rock slide where a stretch of the island's shore is cut short beside a canal's brick bank,
// laid out round the corner of land where the shore ends: `out` from the land through the shore,
// and `end` along the coast towards the brick.
//
// The bank either runs across the shore's end, back along the land's side away from the lake
// ('across'), or carries on along the coast past it ('along'). Either way the shore's rocks have
// slid off its end onto the bank: they cover the shore's cut end from the land out to its far
// edge, and run on down the bank's slope beside it, thinning towards the water and tapering
// along the wall. The whole slide is bedded in earth, so nothing it covers shows between its
// rocks, and none of it lies on the paving.
export type SpillKind = 'across' | 'along'
// `height` is how high up the slide a rock lies, from its foot (0) to its top (1).
export type SpillRock = { u: number; v: number; radius: number; tone: number; height: number }
export type Slide = {
    rocks: SpillRock[]
    // How far a point lies within the slide's bed, from outside (0) to well in (1).
    cover: (u: number, v: number) => number
}

// How far out the shore reaches from the grid, rounded up to one of these: each slide is drawn
// for one, long enough to hide the end of a shore that deep.
export const SPILL_DEPTHS = [8, 12, 16, 20] as const
export type SpillDepth = (typeof SPILL_DEPTHS)[number]

export function spillDepth(shoreDepth: number): SpillDepth {
    return SPILL_DEPTHS.find((depth) => shoreDepth <= depth) ?? SPILL_DEPTHS.at(-1) ?? 20
}

const BANK = SLOPE_WIDTH
const SLIDE = {
    // Down the wall from the shore, and how far the slide laps back over the shore's end.
    length: 20,
    lap: 4,
    largest: 4,
    smallest: 1.2,
    packing: 0.62,
    edge: 1.2
}

const slides = new Map<string, Slide>()

// In the corner's own frame: u along the coast towards the brick, v out from the land.
export function spillSlide(kind: SpillKind, depth: SpillDepth): Slide {
    const key = `${kind}-${depth}`
    const known = slides.get(key)
    if (known) return known
    const next = seededRandom(depth * 613 + (kind === 'across' ? 7 : 19))
    const phases = [next(), next(), next(), next()].map((value) => value * 6.3)
    const wobble = (u: number, v: number) =>
        0.7 * Math.sin(u * 0.55 + v * 0.3 + phases[0]) +
        0.5 * Math.sin(v * 0.7 - u * 0.2 + phases[1]) +
        0.3 * Math.sin((u + v) * 1.3 + phases[2])
    // Along the wall from the shore (s) and across it from the kerb (t) to the water (BANK).
    const wall = (u: number, v: number) => (kind === 'across' ? { s: -v, t: u } : { s: u, t: v })
    const inside = (distance: number) => smoothstep(0, SLIDE.edge, distance)
    // Over the shore's cut end: from the land out past the shore, lapping back over it.
    const head = (u: number, v: number) =>
        Math.min(u + SLIDE.lap, 2.5 - u, v + 1, depth + 0.5 - v - (u < 0 ? 0 : u * 0.5))
    // Down the bank: from the kerb at the shore's end to the foot at the water further on.
    const body = (u: number, v: number) => {
        const { s, t } = wall(u, v)
        const along = clamp(s / SLIDE.length)
        const kerbSide = -0.3 + (BANK - 2.5) * along ** 0.9
        const waterSide = BANK + 1.5 - along
        return Math.min(
            s + (kind === 'across' ? 3 : 1),
            SLIDE.length - s,
            t - kerbSide,
            waterSide - t
        )
    }
    // Never on the paving.
    const land = (u: number, v: number) => (kind === 'across' ? Math.max(u, v) : v)
    const cover = (u: number, v: number) =>
        inside(Math.max(head(u, v), body(u, v)) + wobble(u, v) * 0.6) *
        smoothstep(-0.6, 0, land(u, v))
    // Highest where the shore ends, falling away down the wall and out into the lake.
    const height = (u: number, v: number) => {
        const top = 1 - clamp(Math.hypot((u + 0.5) / 6, (v - depth * 0.3) / (depth * 0.8 + 3)))
        const { s, t } = wall(u, v)
        const down = 0.8 * (1 - clamp(s / SLIDE.length)) ** 1.1 * (1 - 0.3 * clamp(t / BANK))
        return Math.max(top, down)
    }
    const bounds = slideBounds(kind, depth)
    const candidates = Array.from({ length: 5000 }, () => ({
        u: bounds.u0 + next() * (bounds.u1 - bounds.u0),
        v: bounds.v0 + next() * (bounds.v1 - bounds.v0),
        size: next(),
        tone: next()
    }))
        .filter((spot) => cover(spot.u, spot.v) > 0.5)
        .map((spot) => ({ ...spot, height: height(spot.u, spot.v) }))
        .toSorted((a, b) => b.height - a.height)
    const rocks: SpillRock[] = []
    for (const spot of candidates) {
        const radius =
            (SLIDE.smallest + (SLIDE.largest - SLIDE.smallest) * clamp(spot.height) ** 0.8) *
            (0.88 + spot.size * 0.24)
        const clear = rocks.every(
            (rock) =>
                Math.hypot(rock.u - spot.u, rock.v - spot.v) >
                (rock.radius + radius) * SLIDE.packing
        )
        if (clear) {
            rocks.push({
                u: spot.u,
                v: spot.v,
                radius,
                tone: spot.tone,
                height: clamp(spot.height)
            })
        }
    }
    const slide = { rocks, cover }
    slides.set(key, slide)
    return slide
}

// The reach of a slide, in its frame, before its rocks' size.
function slideBounds(kind: SpillKind, depth: SpillDepth) {
    return kind === 'across'
        ? { u0: -SLIDE.lap - 2, u1: BANK + 3, v0: -SLIDE.length - 2, v1: depth + 3 }
        : { u0: -SLIDE.lap - 2, u1: SLIDE.length + 2, v0: -1, v1: Math.max(depth, BANK) + 3 }
}

const STEP: Record<SlopeSide, Point> = {
    n: { x: 0, y: -1 },
    e: { x: 1, y: 0 },
    s: { x: 0, y: 1 },
    w: { x: -1, y: 0 }
}

export function spillFrame(out: SlopeSide, end: SlopeSide): { out: Point; end: Point } {
    return { out: STEP[out], end: STEP[end] }
}

export function toPlan(frame: { out: Point; end: Point }, u: number, v: number): Point {
    return { x: frame.end.x * u + frame.out.x * v, y: frame.end.y * u + frame.out.y * v }
}

// The box round the corner of land that a slide's image covers, in plan.
export function spillBox(out: SlopeSide, end: SlopeSide, kind: SpillKind, depth: SpillDepth): Box {
    const frame = spillFrame(out, end)
    const bounds = slideBounds(kind, depth)
    const margin = SLIDE.largest * 1.12 + 1.5
    const points = [
        toPlan(frame, bounds.u0 - margin, bounds.v0 - margin),
        toPlan(frame, bounds.u1 + margin, bounds.v1 + margin)
    ]
    const x = Math.floor(Math.min(...points.map((p) => p.x)))
    const y = Math.floor(Math.min(...points.map((p) => p.y)))
    const right = Math.ceil(Math.max(...points.map((p) => p.x)))
    const bottom = Math.ceil(Math.max(...points.map((p) => p.y)))
    return { x, y, width: right - x, height: bottom - y }
}
