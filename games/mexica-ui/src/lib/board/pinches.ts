import type { Point } from '@tabletop/common'
import {
    BOARD_HEIGHT,
    BOARD_WIDTH,
    type Cell,
    cellAt,
    columnOf,
    isLand,
    isPalace,
    rowOf
} from '@tabletop/mexica'
import type { Box } from './view.js'
import { CELL } from './view.js'

// A corner of the island's coast where three squares of land meet one of lake. Dig the land
// across the corner from the lake into a canal, and the two squares either side of it touch only
// at the corner: a pinch between two districts. The board's coast, drawn for the island as
// printed, runs round such a corner unbroken, so for a pinch it lays a patch over it with the
// coast drawn back from the corner and the lake reaching in to meet it.
export type PinchCorner = {
    key: string
    // The corner, in plan units.
    at: Point
    // The square of lake at the corner; the square across from it that, dug, makes the pinch;
    // and the two squares either side of the corner.
    lake: Cell
    across: Cell
    sides: readonly [Cell, Cell]
    // Its place in the sheet of patches.
    index: number
}

// How far each patch reaches from its corner, in plan units: past where the coast is drawn back.
export const PINCH_REACH = 20
export const PINCH_SHEET_COLUMNS = 6

function landAt(column: number, row: number): Cell | undefined {
    const cell = cellAt(column, row)
    return cell !== undefined && isLand(cell) ? cell : undefined
}

function findCorners(): PinchCorner[] {
    const corners: PinchCorner[] = []
    for (let row = 1; row < BOARD_HEIGHT; row++) {
        for (let column = 1; column < BOARD_WIDTH; column++) {
            // The squares round the corner, clockwise from the top left.
            const round: [number, number][] = [
                [column - 1, row - 1],
                [column, row - 1],
                [column, row],
                [column - 1, row]
            ]
            const lakes = round.filter(([c, r]) => landAt(c, r) === undefined)
            if (lakes.length !== 1) continue
            const lake = round.indexOf(lakes[0])
            const [ac, ar] = round[(lake + 2) % 4]
            const across = landAt(ac, ar)
            if (across === undefined || isPalace(across)) continue
            const [first, second] = [round[(lake + 1) % 4], round[(lake + 3) % 4]].map(([c, r]) =>
                landAt(c, r)
            )
            if (first === undefined || second === undefined) continue
            const [lc, lr] = round[lake]
            const water = cellAt(lc, lr)
            if (water === undefined) continue
            corners.push({
                key: `pinch-${column}-${row}`,
                at: { x: column * CELL, y: row * CELL },
                lake: water,
                across,
                sides: [first, second],
                index: corners.length
            })
        }
    }
    return corners
}

export const PINCH_CORNERS: readonly PinchCorner[] = findCorners()

// The patch round a corner, in plan units.
export function pinchBox(corner: PinchCorner): Box {
    return {
        x: corner.at.x - PINCH_REACH,
        y: corner.at.y - PINCH_REACH,
        width: PINCH_REACH * 2,
        height: PINCH_REACH * 2
    }
}

// How far in from its edge a patch fades in, over the coast as the board draws it, so it shows
// no edge of its own.
export const PINCH_FEATHER = 4

// Where a corner's patch lies in its sheet, in plan units, and the sheet's size.
export function pinchFrame(corner: PinchCorner): Box {
    const size = PINCH_REACH * 2
    return {
        x: (corner.index % PINCH_SHEET_COLUMNS) * size,
        y: Math.floor(corner.index / PINCH_SHEET_COLUMNS) * size,
        width: size,
        height: size
    }
}

export const PINCH_SHEET: Box = {
    x: 0,
    y: 0,
    width: PINCH_SHEET_COLUMNS * PINCH_REACH * 2,
    height: Math.ceil(PINCH_CORNERS.length / PINCH_SHEET_COLUMNS) * PINCH_REACH * 2
}

// The corners that are pinches with these canals dug: the square across dug and neither side,
// and the square of lake open, not a canal's mouth, which is banked and has no coast.
export function pinchesOf(canals: ReadonlySet<Cell>): PinchCorner[] {
    return PINCH_CORNERS.filter(
        (corner) =>
            canals.has(corner.across) &&
            corner.sides.every((side) => !canals.has(side)) &&
            !besideCanal(corner.lake, canals)
    )
}

function besideCanal(cell: Cell, canals: ReadonlySet<Cell>): boolean {
    const column = columnOf(cell)
    const row = rowOf(cell)
    return [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0]
    ].some(([dc, dr]) => {
        const next = cellAt(column + dc, row + dr)
        return next !== undefined && canals.has(next)
    })
}
