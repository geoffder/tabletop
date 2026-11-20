import { Axis, type Level } from '@tabletop/mexica'
import { CELL, type BoardView, type Point } from './view.js'

// Temples are stepped: each level a square tier, narrower than the one below.
export const TIER_HEIGHT = 0.17
const BASE_HALF = 0.4
const TIER_STEP = 0.065

export interface Tier {
    // The tier's front face and its top, as rectangles on screen.
    front: { x: number; y: number; width: number; height: number }
    top: { x: number; y: number; width: number; height: number }
}

export function templeTiers(view: BoardView, centre: Point, level: Level): Tier[] {
    const tiers: Tier[] = []
    for (let tier = 0; tier < level; tier++) {
        const half = (BASE_HALF - TIER_STEP * tier) * CELL
        const depth = half * view.tilt
        const bottom = view.lift(TIER_HEIGHT * tier)
        const top = view.lift(TIER_HEIGHT * (tier + 1))
        tiers.push({
            front: {
                x: centre.x - half,
                y: centre.y + depth - top,
                width: half * 2,
                height: top - bottom
            },
            top: {
                x: centre.x - half,
                y: centre.y - depth - top,
                width: half * 2,
                height: depth * 2
            }
        })
    }
    return tiers
}

// The level marks on a temple's roof: one dot per level, as the real pieces have.
export function roofDots(view: BoardView, centre: Point, level: Level): Point[] {
    const roof = templeTiers(view, centre, level).at(-1)
    if (roof === undefined) return []
    const cx = roof.top.x + roof.top.width / 2
    const cy = roof.top.y + roof.top.height / 2
    const dx = roof.top.width * 0.22
    const dy = roof.top.height * 0.22
    const layouts: Record<Level, [number, number][]> = {
        1: [[0, 0]],
        2: [
            [-1, -1],
            [1, 1]
        ],
        3: [
            [-1, -1],
            [0, 0],
            [1, 1]
        ],
        4: [
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1]
        ]
    }
    return layouts[level].map(([i, j]) => ({ x: cx + i * dx, y: cy + j * dy }))
}

export function templeHeight(view: BoardView, level: Level): number {
    return view.lift(TIER_HEIGHT * level)
}

// A Pilli Mexica: a noble with a feathered headdress, feet at the origin, 33 units tall.
export const PILLI_PATH =
    'M0 -23 C3.3 -23 6 -20.3 6 -17 C6 -15.3 5.3 -13.8 4.2 -12.7 L12 -10 C13.5 -9.5 14 -8 13 -6.8 L9 -3.5 L11 0 L3 0 L0 -4 L-3 0 L-11 0 L-9 -3.5 L-13 -6.8 C-14 -8 -13.5 -9.5 -12 -10 L-4.2 -12.7 C-5.3 -13.8 -6 -15.3 -6 -17 C-6 -20.3 -3.3 -23 0 -23 Z'
export const PLUME_PATH =
    'M-6.5 -20 L-11 -29 L-4 -24.5 L0 -33 L4 -24.5 L11 -29 L6.5 -20 C4 -23.5 -4 -23.5 -6.5 -20 Z'
export const PILLI_SCALE = (0.62 * CELL) / 33

// A bridge across its canal: a plank with ramps running along the axis, raised in the middle.
export function bridgePaths(
    view: BoardView,
    centre: Point,
    axis: Axis
): { top: string; near?: string; far?: string; body?: string } {
    const rise = view.lift(0.16)
    if (axis === Axis.EastWest) {
        const half = 0.62 * CELL
        const depth = 0.22 * CELL * view.tilt
        const archHalf = 0.28 * CELL
        const front = centre.y + depth
        const body = [
            `M${centre.x - half} ${front}`,
            `L${centre.x - archHalf * 1.4} ${front - rise}`,
            `L${centre.x + archHalf * 1.4} ${front - rise}`,
            `L${centre.x + half} ${front}`,
            `L${centre.x + archHalf} ${front}`,
            `Q${centre.x} ${front - rise * 1.5} ${centre.x - archHalf} ${front}`,
            'Z'
        ].join(' ')
        const top = [
            `M${centre.x - half} ${front}`,
            `L${centre.x - archHalf * 1.4} ${front - rise}`,
            `L${centre.x + archHalf * 1.4} ${front - rise}`,
            `L${centre.x + half} ${front}`,
            `L${centre.x + half} ${front - depth * 2}`,
            `L${centre.x + archHalf * 1.4} ${front - depth * 2 - rise}`,
            `L${centre.x - archHalf * 1.4} ${front - depth * 2 - rise}`,
            `L${centre.x - half} ${front - depth * 2}`,
            'Z'
        ].join(' ')
        return { body, top }
    }
    const half = 0.24 * CELL
    const reach = 0.62 * CELL * view.tilt
    const mid = 0.24 * CELL * view.tilt
    const deckNear = centre.y + mid - rise
    const deckFar = centre.y - mid - rise
    const quad = (y1: number, y2: number) =>
        `M${centre.x - half} ${y1} L${centre.x + half} ${y1} L${centre.x + half} ${y2} L${centre.x - half} ${y2} Z`
    return {
        top: quad(deckNear, deckFar),
        near: quad(centre.y + reach, deckNear),
        far: quad(deckFar, centre.y - reach)
    }
}

// A calpulli token: an octagon lying on the ground.
export function octagon(view: BoardView, centre: Point, radius: number, lift = 0): string {
    const points: string[] = []
    for (let i = 0; i < 8; i++) {
        const angle = ((i + 0.5) * Math.PI) / 4
        points.push(
            `${centre.x + Math.cos(angle) * radius},${centre.y + Math.sin(angle) * radius * view.tilt - lift}`
        )
    }
    return points.join(' ')
}
