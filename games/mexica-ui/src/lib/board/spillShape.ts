import type { Point } from '@tabletop/common'
import { seededRandom } from './random.js'
import { SLOPE_WIDTH, type SlopeSide } from './looks.js'
import type { Box } from './view.js'

// A pile of rocks where a stretch of the island's shore is cut short beside a canal's brick
// bank, laid out round the corner of land where the shore ends: `out` from the land through the
// shore, and `end` along the coast towards the brick.
//
// The bank either runs across the shore's end, back along the land's side away from the lake
// ('across'), or carries on along the coast past it ('along'). Either way the shore's rocks heap
// up over the bank's end, as one pile sloping down from the corner into the water, its biggest
// rocks highest and the smaller ones settling round its foot, never onto the paving.
export type SpillKind = 'across' | 'along'
// `height` is how high up the pile a rock lies, from its foot (0) to its top (1).
export type SpillRock = { u: number; v: number; radius: number; tone: number; height: number }

export const SPILL_VARIANTS = 2

const BANK = SLOPE_WIDTH
const PILE = { reach: 10, largest: 4.2, smallest: 1.3, taper: 0.6, packing: 0.8 }

// In the corner's own frame: u along the coast towards the brick, v out from the land.
export function spillRocks(kind: SpillKind, variant: number): SpillRock[] {
    const next = seededRandom(variant * 613 + (kind === 'across' ? 7 : 19))
    // The pile's top, over the end of the bank where it meets the shore.
    const top = kind === 'across' ? { u: BANK * 0.25, v: 5 } : { u: 0.5, v: BANK * 0.6 }
    const [phase, phase2] = [next() * 6.3, next() * 6.3]
    const reach = (angle: number) =>
        PILE.reach * (1 + 0.12 * Math.sin(3 * angle + phase) + 0.08 * Math.sin(5 * angle + phase2))
    // Off the paving, and across a canal no further than its bank and a little beyond.
    const allowed = (u: number, v: number) =>
        kind === 'across' ? !(u < 0 && v < 0) && u <= BANK + 2.5 : v >= -0.5
    const candidates = Array.from({ length: 900 }, () => ({
        u: top.u + (next() * 2 - 1) * PILE.reach * 1.25,
        v: top.v + (next() * 2 - 1) * PILE.reach * 1.25,
        size: next(),
        tone: next(),
        keep: next()
    }))
        .map((spot) => {
            const du = spot.u - top.u
            const dv = spot.v - top.v
            return { ...spot, down: Math.hypot(du, dv) / reach(Math.atan2(dv, du)) }
        })
        .filter((spot) => spot.down <= 1 && allowed(spot.u, spot.v))
        .toSorted((a, b) => a.down - b.down)
    const rocks: SpillRock[] = []
    for (const spot of candidates) {
        // Smaller and fewer towards the foot, so the pile tapers into the water.
        const radius =
            (PILE.largest - (PILE.largest - PILE.smallest) * spot.down ** PILE.taper) *
            (0.88 + spot.size * 0.24)
        const clear =
            spot.keep > spot.down ** 2 * 0.6 &&
            rocks.every(
                (rock) =>
                    Math.hypot(rock.u - spot.u, rock.v - spot.v) >
                    (rock.radius + radius) * PILE.packing
            )
        if (clear)
            rocks.push({ u: spot.u, v: spot.v, radius, tone: spot.tone, height: 1 - spot.down })
    }
    return rocks
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

// The box round the corner of land that a spill's image covers, in plan.
export function spillBox(out: SlopeSide, end: SlopeSide, kind: SpillKind, variant: number): Box {
    const frame = spillFrame(out, end)
    const points = spillRocks(kind, variant).flatMap((rock) =>
        [-1, 1].flatMap((du) =>
            [-1, 1].map((dv) =>
                toPlan(frame, rock.u + du * (rock.radius + 1.5), rock.v + dv * (rock.radius + 1.5))
            )
        )
    )
    const x = Math.floor(Math.min(...points.map((p) => p.x)))
    const y = Math.floor(Math.min(...points.map((p) => p.y)))
    const right = Math.ceil(Math.max(...points.map((p) => p.x)))
    const bottom = Math.ceil(Math.max(...points.map((p) => p.y)))
    return { x, y, width: right - x, height: bottom - y }
}
