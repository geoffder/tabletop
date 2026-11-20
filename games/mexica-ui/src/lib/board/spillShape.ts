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
    smallest: 1.6,
    packing: 0.62
}

type UV = { u: number; v: number }

// The slide's edge, in its frame, round from the land at the shore's end.
function slideOutline(kind: SpillKind, depth: SpillDepth): UV[] {
    const { length, lap } = SLIDE
    const top = kind === 'across' ? depth : Math.max(depth, BANK + 2.5)
    // The head's side over the lake, and the wall's foot beyond it: the slide's edge runs
    // straight across the inside corner between them, as scree slid off the shore's end.
    const side = kind === 'across' ? 2.5 : 2
    const head = { u: side, v: top }
    const foot =
        kind === 'across'
            ? { u: BANK + 1.5, v: 0.5 }
            : { u: side + Math.max(3, top - (BANK + 1.5)), v: BANK + 1.5 }
    const shore = [{ u: -lap, v: 0 }, { u: -lap, v: top - 1 }, { u: -lap + 1, v: top }, head]
    const wall =
        kind === 'across'
            ? [
                  { u: BANK + 1.2, v: -length * 0.6 },
                  { u: BANK + 0.3, v: -length },
                  { u: BANK - 2.5, v: -length + 0.5 },
                  { u: 0.2, v: -1 },
                  { u: 0, v: 0 }
              ]
            : [
                  { u: length * 0.6, v: BANK + 1.2 },
                  { u: length, v: BANK + 0.3 },
                  { u: length - 0.5, v: BANK - 2.5 },
                  { u: 1, v: 0 }
              ]
    return [...shore, foot, ...wall]
}

// How far inside an outline a point lies (negative outside).
function within(outline: readonly UV[], u: number, v: number): number {
    let nearest = Infinity
    let inside = false
    for (let index = 0; index < outline.length; index++) {
        const a = outline[index]
        const b = outline[(index + 1) % outline.length]
        const du = b.u - a.u
        const dv = b.v - a.v
        const along = clamp(((u - a.u) * du + (v - a.v) * dv) / (du * du + dv * dv))
        nearest = Math.min(nearest, Math.hypot(u - a.u - du * along, v - a.v - dv * along))
        if (a.v > v !== b.v > v && u < a.u + ((v - a.v) / (b.v - a.v)) * du) inside = !inside
    }
    return inside ? nearest : -nearest
}

const slides = new Map<string, Slide>()

// In the corner's own frame: u along the coast towards the brick, v out from the land.
export function spillSlide(kind: SpillKind, depth: SpillDepth): Slide {
    const key = `${kind}-${depth}`
    const known = slides.get(key)
    if (known) return known
    const next = seededRandom(depth * 613 + (kind === 'across' ? 7 : 19))
    const phases = [next(), next()].map((value) => value * 6.3)
    const wobble = (u: number, v: number) =>
        0.3 * Math.sin(u * 0.55 + v * 0.3 + phases[0]) +
        0.2 * Math.sin(v * 0.7 - u * 0.2 + phases[1])
    const outline = slideOutline(kind, depth)
    // Along the wall from the shore (s) and across it from the kerb (t) to the water (BANK).
    const wall = (u: number, v: number) => (kind === 'across' ? { s: -v, t: u } : { s: u, t: v })
    // Never on the paving.
    const land = (u: number, v: number) => (kind === 'across' ? Math.max(u, v) : v)
    const cover = (u: number, v: number) =>
        smoothstep(0, 1, within(outline, u, v) + wobble(u, v)) * smoothstep(-0.6, 0, land(u, v))
    // Biggest where the shore ends, smaller down the wall and out into the lake.
    const height = (u: number, v: number) => {
        const top = 1 - clamp(Math.hypot((u + 0.5) / 6, (v - depth * 0.3) / (depth * 0.8 + 3)))
        const { s, t } = wall(u, v)
        const down = 0.8 * (1 - clamp(s / SLIDE.length)) ** 1.1 * (1 - 0.3 * clamp(t / BANK))
        return clamp(Math.max(top, down))
    }
    const bounds = slideBounds(kind, depth)
    const candidates = Array.from({ length: 5000 }, () => {
        const u = bounds.u0 + next() * (bounds.u1 - bounds.u0)
        const v = bounds.v0 + next() * (bounds.v1 - bounds.v0)
        const up = height(u, v)
        const radius =
            (SLIDE.smallest + (SLIDE.largest - SLIDE.smallest) * up ** 0.8) * (0.88 + next() * 0.24)
        return { u, v, height: up, radius, tone: next() }
    })
        // Each rock lies mostly within the slide's edge, so none stands off it alone.
        .filter((spot) => within(outline, spot.u, spot.v) >= spot.radius * 0.45)
        .filter((spot) => land(spot.u, spot.v) >= -0.3)
        .toSorted((a, b) => b.height - a.height)
    const rocks: SpillRock[] = []
    for (const spot of candidates) {
        const clear = rocks.every(
            (rock) =>
                Math.hypot(rock.u - spot.u, rock.v - spot.v) >
                (rock.radius + spot.radius) * SLIDE.packing
        )
        if (clear) rocks.push(spot)
    }
    const slide = { rocks, cover }
    slides.set(key, slide)
    return slide
}

// The reach of a slide's edge, in its frame, before its rocks' size.
function slideBounds(kind: SpillKind, depth: SpillDepth) {
    const outline = slideOutline(kind, depth)
    return {
        u0: Math.min(...outline.map((p) => p.u)),
        u1: Math.max(...outline.map((p) => p.u)),
        v0: Math.min(...outline.map((p) => p.v)),
        v1: Math.max(...outline.map((p) => p.v))
    }
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
    const margin = SLIDE.largest * 1.12 + 2
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
