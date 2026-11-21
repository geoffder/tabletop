import { type Cell, isPalace, PALACE_CENTRE } from '@tabletop/mexica'
import type { Block } from './templeShape.js'
import { blockFaces } from './templeShape.js'
import { CELL, type Box } from './view.js'

// The Emperor's palace: a cross of dark stone over the five palace spaces, in board units round
// the emblem's centre (x right, y towards the viewer, z up). Its arms are flat on top, laid in
// blocks, and step down to the ground at their ends in broad stairs; in the middle a raised
// square carries the bronze emblem. The cross looks the same from every side, so one image
// serves every turn of the board.
export const PALACE = {
    inset: 1.5,
    rise: 9,
    // Where each arm's top ends and its stair begins, from the middle.
    flat: 36,
    steps: 5,
    centre: { half: 17, rise: 2, top: 13, above: 1.5 },
    emblem: { radius: 11, depth: 0.6 }
}

export type PalaceMaterial = 'stone' | 'stair'
export type PalacePart = { block: Block; round: number; material: PalaceMaterial }

const SIDE = CELL / 2 - PALACE.inset
const REACH = 1.5 * CELL - PALACE.inset
const TREAD = (REACH - PALACE.flat) / PALACE.steps

// The top of the stair `along` from the middle, on any arm.
function stairTop(along: number): number {
    if (along <= PALACE.flat) return PALACE.rise
    const step = Math.min(PALACE.steps - 1, Math.floor((along - PALACE.flat) / TREAD))
    return (PALACE.rise * (PALACE.steps - step)) / (PALACE.steps + 1)
}

export function palaceParts(): PalacePart[] {
    const { flat, steps, rise, centre } = PALACE
    const part = (block: Block, material: PalaceMaterial, round = 0.5) => ({
        block,
        material,
        round
    })
    // A block on the arm running right from the middle, and the same on the other three.
    const turned = (a0: number, a1: number, c0: number, c1: number, z0: number, z1: number) => [
        { x0: a0, x1: a1, y0: c0, y1: c1, z0, z1 },
        { x0: -a1, x1: -a0, y0: c0, y1: c1, z0, z1 },
        { x0: c0, x1: c1, y0: a0, y1: a1, z0, z1 },
        { x0: c0, x1: c1, y0: -a1, y1: -a0, z0, z1 }
    ]
    const arms = turned(0, flat, -SIDE, SIDE, 0, rise).map((block) => part(block, 'stone'))
    // Each step runs from the top's end out to its own edge, lower the further out it reaches.
    const stairs = Array.from({ length: steps }, (_, step) =>
        turned(
            flat - 0.3,
            flat + (step + 1) * TREAD,
            -SIDE,
            SIDE,
            0,
            stairTop(flat + step * TREAD + 0.1)
        )
    )
        .flat()
        .map((block) => part(block, 'stair', 0.3))
    const square = (half: number, top: number) => ({
        x0: -half,
        x1: half,
        y0: -half,
        y1: half,
        z0: 0,
        z1: top
    })
    const middle = [
        part(square(centre.half, rise + centre.rise), 'stone'),
        part(square(centre.top, rise + centre.rise + centre.above), 'stone')
    ]
    return [...arms, ...stairs, ...middle]
}

// The top of the emblem, where a Pilli Mexica on the middle space stands.
export const PALACE_TOP =
    PALACE.rise + PALACE.centre.rise + PALACE.centre.above + PALACE.emblem.depth

// How high a Pilli Mexica on a palace space stands, as a share of a cell: on the emblem in the
// middle, part way down the stair on an arm.
export function palaceRise(cell: Cell): number {
    if (!isPalace(cell)) return 0
    if (cell === PALACE_CENTRE) return PALACE_TOP / CELL
    return stairTop(CELL) / CELL
}

export function palaceBounds(tilt: number): Box {
    const blocks = [
        ...palaceParts().map(({ block }) => block),
        { x0: -1, x1: 1, y0: -1, y1: 1, z0: 0, z1: PALACE_TOP }
    ]
    const faces = blocks.flatMap((block) => {
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

export function palaceLook(flat: boolean): string {
    return `palace${flat ? '-flat' : ''}`
}
