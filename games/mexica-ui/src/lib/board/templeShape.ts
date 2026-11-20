import type { Point } from '@tabletop/common'
import type { Level } from '@tabletop/mexica'
import { CELL, TIER_HEIGHT, type Box } from './view.js'

// A block of stone in board units round a cell's centre: x to the right, y towards the viewer,
// z up.
export type Block = { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }

export const TEMPLE = {
    half: 0.4 * CELL,
    inset: 0.065 * CELL,
    tier: TIER_HEIGHT * CELL,
    stairHalf: 0.13 * CELL,
    stairReach: 3,
    stepsPerTier: 2,
    wall: { width: 1.4, above: 1.2 },
    balustrade: {
        width: 2.2,
        above: 2.4,
        head: { width: 3, depth: 1.6, reach: 1.2, height: 3.6 }
    },
    round: 1.4,
    stairRound: 0.3,
    pip: { radius: 2.2, depth: 1.4, spacing: 4.6, margin: 1.2 }
}

// How a temple shows its level beyond its count of tiers: the first tier's height as a share of
// the others, pips cut into the top, and a building on the top that changes with the level.
export type PipLayout = 'dice' | 'row' | 'cluster' | 'front'

// How the stair stands out from the tiers under the owner's tint: `shade` darkens its wash,
// `glint` picks out each tread's front edge, `riser` dims the faces of its steps towards the
// viewer, and balustrades are heavier side walls ending at the foot in a block each side.
export type StairLook = { shade: number; glint: number; riser: number; balustrade: boolean }

export type TempleDesign = {
    base: number
    pips: 'none' | 'carved' | 'painted'
    layout: PipLayout
    shrines: boolean
    stair: StairLook
}

export const DESIGN: TempleDesign = {
    base: 1,
    pips: 'carved',
    layout: 'cluster',
    shrines: false,
    stair: { shade: 0.05, glint: 0.32, riser: 0.78, balustrade: false }
}

export function riseOf(tilt: number): number {
    return Math.sqrt(1 - tilt * tilt)
}

function tierHeight(tier: number, design: TempleDesign): number {
    return tier === 0 ? TEMPLE.tier * design.base : TEMPLE.tier
}

function tierTop(tier: number, design: TempleDesign): number {
    let top = 0
    for (let below = 0; below <= tier; below++) top += tierHeight(below, design)
    return top
}

export function tierBlocks(level: Level, design = DESIGN): Block[] {
    return Array.from({ length: level }, (_, tier) => {
        const half = TEMPLE.half - TEMPLE.inset * tier
        return {
            x0: -half,
            x1: half,
            y0: -half,
            y1: half,
            z0: tierTop(tier, design) - tierHeight(tier, design),
            z1: tierTop(tier, design)
        }
    })
}

export function peakOf(level: Level, design = DESIGN): number {
    return tierTop(level - 1, design)
}

export type StairParts = { steps: Block[]; walls: Block[] }

// The stair up the front, from just before the base to the top tier's front edge, between
// low walls a little higher than its steps. Balustrades are heavier and end at the foot in a
// block each side.
export function stairParts(level: Level, design = DESIGN): StairParts {
    const front = TEMPLE.half + TEMPLE.stairReach
    const top = topHalf(level)
    const peak = peakOf(level, design)
    const count = TEMPLE.stepsPerTier * level
    const run = (front - top) / count
    const rise = peak / count
    const half = TEMPLE.stairHalf
    const wall = design.stair.balustrade ? TEMPLE.balustrade : TEMPLE.wall
    const y0 = top - TEMPLE.inset
    const steps = Array.from({ length: count }, (_, step) => ({
        x0: -half,
        x1: half,
        y0,
        y1: front - run * step,
        z0: 0,
        z1: rise * (step + 1)
    }))
    const walls = steps.flatMap((step) => {
        const z1 = Math.min(step.z1 + wall.above, peak)
        return [
            { ...step, x0: -half - wall.width, x1: -half, z1 },
            { ...step, x0: half, x1: half + wall.width, z1 }
        ]
    })
    if (!design.stair.balustrade) return { steps, walls }
    const head = TEMPLE.balustrade.head
    const heads = [-1, 1].map((side) => {
        const middle = side * (half + wall.width / 2)
        return {
            x0: middle - head.width / 2,
            x1: middle + head.width / 2,
            y0: front - head.depth,
            y1: front + head.reach,
            z0: 0,
            z1: head.height
        }
    })
    return { steps, walls: [...walls, ...heads] }
}

export function stairBlocks(level: Level, design = DESIGN): Block[] {
    const { steps, walls } = stairParts(level, design)
    return [...steps, ...walls]
}

export function topHalf(level: Level): number {
    return TEMPLE.half - TEMPLE.inset * (level - 1)
}

// On the top: an altar at level 1, a shrine at 2, a shrine with a roof comb at 3, two shrines
// at 4. Each shrine's doorway faces the stair.
export function shrineBlocks(level: Level, design = DESIGN): Block[] {
    if (!design.shrines) return []
    const z0 = peakOf(level, design)
    const half = TEMPLE.half - TEMPLE.inset * (level - 1)
    const house = (x: number, width: number): Block => ({
        x0: x - width / 2,
        x1: x + width / 2,
        y0: -half * 0.7,
        y1: half * 0.25,
        z0,
        z1: z0 + TEMPLE.tier * 0.75
    })
    switch (level) {
        case 1:
            return [{ x0: -2.6, x1: 2.6, y0: -3.2, y1: 0.8, z0, z1: z0 + TEMPLE.tier * 0.3 }]
        case 2:
            return [house(0, half * 1.1)]
        case 3: {
            const shrine = house(0, half * 1.1)
            const comb = {
                x0: shrine.x0 + 1,
                x1: shrine.x1 - 1,
                y0: shrine.y0 + 0.4,
                y1: shrine.y0 + 1.6,
                z0: shrine.z1,
                z1: shrine.z1 + TEMPLE.tier * 0.4
            }
            return [shrine, comb]
        }
        case 4:
            return [house(-half * 0.42, half * 0.72), house(half * 0.42, half * 0.72)]
    }
}

// Doorways cut into the shrines' fronts.
export function doorwayBlocks(level: Level, design = DESIGN): Block[] {
    return shrineBlocks(level, design)
        .filter((block) => block.z1 - block.z0 > TEMPLE.tier * 0.5 && block.y1 - block.y0 > 2)
        .map((block) => {
            const middle = (block.x0 + block.x1) / 2
            const width = Math.min(2.6, (block.x1 - block.x0) * 0.35)
            return {
                x0: middle - width / 2,
                x1: middle + width / 2,
                y0: block.y1 - 1.2,
                y1: block.y1 + 1,
                z0: block.z0 - 1,
                z1: block.z0 + (block.z1 - block.z0) * 0.62
            }
        })
}

export type Pip = Point & { radius: number }

// Pips cut into the top tier's top, as many as the level.
export function pipCentres(level: Level, design = DESIGN): Pip[] {
    if (design.pips === 'none') return []
    const { radius, spacing, margin } = TEMPLE.pip
    const half = TEMPLE.half - TEMPLE.inset * (level - 1)
    const room = half - radius - margin
    const gap = 1.1
    // A row shrinks its pips to fit the top with a gap between each.
    const row = (y: number) => {
        const fitted = Math.min(radius, (2 * (half - margin) - gap * (level - 1)) / (2 * level))
        const step = fitted * 2 + gap
        return Array.from({ length: level }, (_, index) => ({
            x: (index - (level - 1) / 2) * step,
            y,
            radius: fitted
        }))
    }
    const sized = (points: [number, number][], scale: number, lift: number) =>
        points.map(([x, y]) => ({ x: x * scale, y: y * scale + lift, radius }))
    const near = (radius + 0.4) * 1.15
    switch (design.layout) {
        case 'dice': {
            const s = Math.min(spacing, room)
            const dice: Record<Level, [number, number][]> = {
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
            return sized(dice[level], s, -1)
        }
        case 'row':
            return row(-1)
        case 'cluster': {
            const cluster: Record<Level, [number, number][]> = {
                1: [[0, 0]],
                2: [
                    [-1, 0],
                    [1, 0]
                ],
                3: [
                    [-1, 0.6],
                    [1, 0.6],
                    [0, -1.1]
                ],
                4: [
                    [-1, -1],
                    [1, -1],
                    [-1, 1],
                    [1, 1]
                ]
            }
            return sized(cluster[level], near, -1)
        }
        case 'front':
            return row(half - margin - Math.min(radius, (half - margin) / level))
    }
}

export function pipTop(level: Level, design = DESIGN): number {
    return peakOf(level, design)
}

// The pips as ellipses on screen, round a temple's centre.
export function pipEllipses(level: Level, tilt: number, design = DESIGN): Box[] {
    const z = pipTop(level, design)
    const rise = riseOf(tilt)
    return pipCentres(level, design).map((pip) => {
        const r = pip.radius * 0.82
        return {
            x: pip.x - r,
            y: pip.y * tilt - z * rise - r * tilt,
            width: r * 2,
            height: r * 2 * tilt
        }
    })
}

export function templeBlocks(level: Level, design = DESIGN): Block[] {
    return [
        ...tierBlocks(level, design),
        ...stairBlocks(level, design),
        ...shrineBlocks(level, design)
    ]
}

// Seen along y and z, a block shows only its top and the face towards the viewer.
export function blockFaces(block: Block, tilt: number): { top: Box; front: Box } {
    const rise = riseOf(tilt)
    const width = block.x1 - block.x0
    const topFar = block.y0 * tilt - block.z1 * rise
    const topNear = block.y1 * tilt - block.z1 * rise
    const foot = block.y1 * tilt - block.z0 * rise
    return {
        top: { x: block.x0, y: topFar, width, height: topNear - topFar },
        front: { x: block.x0, y: topNear, width, height: foot - topNear }
    }
}

export function templeBounds(level: Level, tilt: number, design = DESIGN): Box {
    const faces = templeBlocks(level, design).flatMap((block) => {
        const { top, front } = blockFaces(block, tilt)
        return [top, front]
    })
    const margin = 1
    const x = Math.min(...faces.map((face) => face.x)) - margin
    const y = Math.min(...faces.map((face) => face.y)) - margin
    const right = Math.max(...faces.map((face) => face.x + face.width)) + margin
    const bottom = Math.max(...faces.map((face) => face.y + face.height)) + margin
    return { x, y, width: right - x, height: bottom - y }
}
