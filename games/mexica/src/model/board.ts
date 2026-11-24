import * as Type from 'typebox'

export const BOARD_WIDTH = 21
export const BOARD_HEIGHT = 14
export const CELL_COUNT = BOARD_WIDTH * BOARD_HEIGHT

// The island as printed: '#' land, 'P' the Emperor's palace, '=' the canal dug before play,
// '~' the lake. Columns A–U, rows 1–14 from the top.
const ISLAND = [
    '~#~~~#####~~~~~~~~~~~',
    '~###########~~~~~~~~~',
    '############~~~~~~~~~',
    '##############~~~~~~~',
    '~###############~~~~~',
    '~######P######=###~##',
    '~#####PPP#####=######',
    '~######P######=######',
    '~~############=#####~',
    '~################~~~~',
    '###############~~~~~~',
    '#############~~~~~~~~',
    '###########~~~~~~~~~~',
    '~~####~~##~~~~~~~~~~~'
]

export type Cell = number
export const CellSchema = Type.Integer({ minimum: 0, maximum: CELL_COUNT - 1 })

export enum Direction {
    North = 'north',
    East = 'east',
    South = 'south',
    West = 'west'
}

export const DIRECTIONS = [Direction.North, Direction.East, Direction.South, Direction.West]

const STEP: Record<Direction, { dx: number; dy: number }> = {
    [Direction.North]: { dx: 0, dy: -1 },
    [Direction.East]: { dx: 1, dy: 0 },
    [Direction.South]: { dx: 0, dy: 1 },
    [Direction.West]: { dx: -1, dy: 0 }
}

// A bridge runs across its canal: north–south or east–west.
export enum Axis {
    NorthSouth = 'ns',
    EastWest = 'ew'
}

export const AxisSchema = Type.Enum(Axis)

export function cellAt(column: number, row: number): Cell | undefined {
    if (!Number.isInteger(column) || !Number.isInteger(row)) return undefined
    if (column < 0 || column >= BOARD_WIDTH || row < 0 || row >= BOARD_HEIGHT) return undefined
    return row * BOARD_WIDTH + column
}

export function columnOf(cell: Cell): number {
    return cell % BOARD_WIDTH
}

export function rowOf(cell: Cell): number {
    return Math.floor(cell / BOARD_WIDTH)
}

export function isCell(cell: number): boolean {
    return Number.isInteger(cell) && cell >= 0 && cell < CELL_COUNT
}

function symbolAt(cell: Cell): string {
    return ISLAND[rowOf(cell)][columnOf(cell)]
}

const ALL_CELLS: Cell[] = Array.from({ length: CELL_COUNT }, (_, cell) => cell)

export const LAND_CELLS: readonly Cell[] = ALL_CELLS.filter((cell) => symbolAt(cell) !== '~')
const LAND = new Set(LAND_CELLS)

export const PALACE_CELLS: readonly Cell[] = ALL_CELLS.filter((cell) => symbolAt(cell) === 'P')
const PALACE = new Set(PALACE_CELLS)

// The four palace spaces round the emblem; the Pilli Mexica start on them.
export const START_CELLS: readonly Cell[] = PALACE_CELLS.filter(
    (cell) =>
        PALACE_CELLS.filter(
            (other) =>
                Math.abs(columnOf(other) - columnOf(cell)) +
                    Math.abs(rowOf(other) - rowOf(cell)) ===
                1
        ).length === 1
)
const START = new Set(START_CELLS)

export const PALACE_CENTRE: Cell = PALACE_CELLS.filter((cell) => !START.has(cell))[0]

// Two double canal tiles cover the dug canal at the start, top pair first.
export const STARTING_CANALS: readonly (readonly Cell[])[] = (() => {
    const dug = ALL_CELLS.filter((cell) => symbolAt(cell) === '=')
    return [dug.slice(0, 2), dug.slice(2, 4)]
})()

export function isLand(cell: number): boolean {
    return LAND.has(cell)
}

export function isLake(cell: number): boolean {
    return isCell(cell) && !LAND.has(cell)
}

export function isPalace(cell: Cell): boolean {
    return PALACE.has(cell)
}

export function isStart(cell: Cell): boolean {
    return START.has(cell)
}

// The neighbouring cell in a direction, or undefined beyond the board's edge (which is lake).
// Looked up rather than worked out: the rule queries ask it of every square many times over.
const NEXT = new Map(
    DIRECTIONS.map((direction) => {
        const { dx, dy } = STEP[direction]
        return [
            direction,
            ALL_CELLS.map((cell) => cellAt(columnOf(cell) + dx, rowOf(cell) + dy))
        ] as const
    })
)
export function neighbour(cell: Cell, direction: Direction): Cell | undefined {
    return NEXT.get(direction)?.[cell]
}

const NEIGHBOURS: readonly (readonly Cell[])[] = ALL_CELLS.map((cell) =>
    DIRECTIONS.map((direction) => neighbour(cell, direction)).filter(
        (next): next is Cell => next !== undefined
    )
)
export function neighbours(cell: Cell): readonly Cell[] {
    return NEIGHBOURS[cell] ?? []
}

export function areAdjacent(a: Cell, b: Cell): boolean {
    return Math.abs(columnOf(a) - columnOf(b)) + Math.abs(rowOf(a) - rowOf(b)) === 1
}

// Whether the cell touches the lake on a side or a corner; beyond the board is lake.
export function touchesLake(cell: Cell): boolean {
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue
            const next = cellAt(columnOf(cell) + dx, rowOf(cell) + dy)
            if (next === undefined || !isLand(next)) return true
        }
    }
    return false
}

// The two cells a bridge's ramps rest on.
export function bridgeEnds(cell: Cell, axis: Axis): [Cell | undefined, Cell | undefined] {
    return axis === Axis.NorthSouth
        ? [neighbour(cell, Direction.North), neighbour(cell, Direction.South)]
        : [neighbour(cell, Direction.West), neighbour(cell, Direction.East)]
}

// BoardSpace style: column letter then row number, "H7" for the emblem.
export function cellName(cell: Cell): string {
    return `${String.fromCharCode(65 + columnOf(cell))}${rowOf(cell) + 1}`
}

export function manhattan(a: Cell, b: Cell): number {
    return Math.abs(columnOf(a) - columnOf(b)) + Math.abs(rowOf(a) - rowOf(b))
}
