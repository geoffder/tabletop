import type { Point } from '@tabletop/common'
import { seededRandom } from './random.js'
import { SLOPE_WIDTH, type SlopeSide } from './looks.js'
import type { Box } from './view.js'

// A spill of rocks where a stretch of the island's shore is cut short beside a canal's brick
// bank, laid out round the corner of land where the shore ends: `out` from the land through the
// shore, and `end` along the coast towards the brick.
//
// The bank either runs across the shore's end, back along the land's side away from the lake
// ('across'), or carries on along the coast past it ('along'). Either way the rocks heap at the
// end of the shore and spill down the bank's slope on a slant, settling on its lower half and
// into the water, never up onto its kerb.
export type SpillKind = 'across' | 'along'
// The first few rocks are the heap on the shore, bedded in its earth.
export type SpillRock = { u: number; v: number; radius: number; tone: number }
export const SPILL_HEAP = 4

export const SPILL_VARIANTS = 2

const BANK = SLOPE_WIDTH

// In the corner's own frame: u along the coast towards the brick, v out from the land.
export function spillRocks(kind: SpillKind, variant: number): SpillRock[] {
    const next = seededRandom(variant * 613 + (kind === 'across' ? 7 : 19))
    const jitter = (by: number) => (next() - 0.5) * by
    // The heap at the end of the shore.
    const heap = [
        { u: -2.2, v: 3.5, radius: 3.1 },
        { u: -0.6, v: 7.5, radius: 3.3 },
        { u: -3.4, v: 10.5, radius: 2.6 },
        kind === 'across' ? { u: 0.6, v: 2.6, radius: 2.4 } : { u: -1.4, v: 12.8, radius: 2.2 }
    ]
    // Down the slope on a slant, smaller as they go.
    const trail =
        kind === 'across'
            ? [
                  { u: BANK * 0.35, v: 0.2, radius: 2.5 },
                  { u: BANK * 0.6, v: -2.6, radius: 2.2 },
                  { u: BANK * 0.82, v: -5.4, radius: 1.9 },
                  { u: BANK * 1.08, v: -7.6, radius: 1.5 },
                  { u: BANK * 0.95, v: 4.2, radius: 1.8 }
              ]
            : [
                  { u: 2.6, v: BANK * 0.6, radius: 2.4 },
                  { u: 5.2, v: BANK * 0.8, radius: 2.1 },
                  { u: 7.8, v: BANK * 1.02, radius: 1.8 },
                  { u: 10.2, v: BANK * 1.22, radius: 1.4 },
                  { u: 3.4, v: BANK * 1.35, radius: 1.6 }
              ]
    return [...heap, ...trail].map((rock) => ({
        u: rock.u + jitter(1.2),
        v: rock.v + jitter(1.2),
        radius: rock.radius * (0.88 + next() * 0.24),
        tone: next()
    }))
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
