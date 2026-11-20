import type { Level } from '@tabletop/mexica'
import { CELL, TIER_HEIGHT, type Box } from './view.js'

// A block of stone in board units round a cell's centre: x to the right, y towards the viewer,
// z up.
export type Block = { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }

export const TEMPLE = {
    half: 0.4 * CELL,
    inset: 0.065 * CELL,
    tier: TIER_HEIGHT * CELL,
    stairHalf: 0.11 * CELL,
    stepsPerTier: 3,
    round: 1.4,
    stairRound: 0.35
}

export function riseOf(tilt: number): number {
    return Math.sqrt(1 - tilt * tilt)
}

export function tierBlocks(level: Level): Block[] {
    return Array.from({ length: level }, (_, tier) => {
        const half = TEMPLE.half - TEMPLE.inset * tier
        return {
            x0: -half,
            x1: half,
            y0: -half,
            y1: half,
            z0: TEMPLE.tier * tier,
            z1: TEMPLE.tier * (tier + 1)
        }
    })
}

// The stair up the front, from the base's front edge to the top tier's.
export function stairBlocks(level: Level): Block[] {
    const front = TEMPLE.half
    const top = TEMPLE.half - TEMPLE.inset * (level - 1)
    const steps = TEMPLE.stepsPerTier * level
    const run = (front - top) / steps
    const height = (TEMPLE.tier * level) / steps
    return Array.from({ length: steps }, (_, step) => ({
        x0: -TEMPLE.stairHalf,
        x1: TEMPLE.stairHalf,
        y0: top - TEMPLE.inset,
        y1: front - run * step,
        z0: 0,
        z1: height * (step + 1)
    }))
}

export function templeBlocks(level: Level): Block[] {
    return [...tierBlocks(level), ...stairBlocks(level)]
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

export function templeBounds(level: Level, tilt: number): Box {
    const faces = templeBlocks(level).flatMap((block) => {
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
