import type { Point } from '@tabletop/common'
import { Axis, BOARD_HEIGHT, BOARD_WIDTH, type Cell, columnOf, rowOf } from '@tabletop/mexica'

export const CELL = 40
export const TILT = 0.75
export const FLAT = 1

export const TIER_HEIGHT = 0.17
export const BRIDGE_RISE = 0.16
export const PILLI_HEIGHT = 0.62 * CELL

const LABEL_SIZE = 12
const LABEL_GAP = 8
const LABEL_REACH = LABEL_SIZE * 0.9
const EDGE_MARGIN = 10
const CONTROLS_ROOM = 34

export type Box = { x: number; y: number; width: number; height: number }

export type Label = { key: string; text: string; at: Point }

export type QuarterTurns = 0 | 1 | 2 | 3

// The board as one view shows it: seen from the near side of the table at `tilt` (1 is straight
// down), turned `quarterTurns` quarter turns clockwise. Plan coordinates are in cells from the
// top-left corner of the printed board.
export class BoardView {
    readonly rise: number
    readonly flat: boolean
    readonly width: number
    readonly depth: number
    readonly frame: Box
    readonly viewBox: string
    readonly labels: Label[]
    // Places plan coordinates in board units (a cell is CELL wide) on screen.
    readonly planTransform: string

    constructor(
        readonly tilt: number,
        readonly quarterTurns: QuarterTurns
    ) {
        this.rise = Math.sqrt(1 - tilt * tilt)
        this.flat = tilt === FLAT
        const sideways = quarterTurns % 2 === 1
        this.width = (sideways ? BOARD_HEIGHT : BOARD_WIDTH) * CELL
        this.depth = (sideways ? BOARD_WIDTH : BOARD_HEIGHT) * CELL * tilt
        this.planTransform = this.makePlanTransform()
        this.labels = this.makeLabels()
        this.frame = this.makeFrame()
        this.viewBox = `${this.frame.x} ${this.frame.y} ${this.frame.width} ${this.frame.height}`
    }

    at(column: number, row: number): Point {
        const [u, v] = this.turn(column, row)
        return { x: u * CELL, y: v * CELL * this.tilt }
    }

    centre(cell: Cell): Point {
        return this.at(columnOf(cell) + 0.5, rowOf(cell) + 0.5)
    }

    cellBox(cell: Cell): Box {
        return this.planBox(columnOf(cell), rowOf(cell), columnOf(cell) + 1, rowOf(cell) + 1)
    }

    planBox(left: number, top: number, right: number, bottom: number): Box {
        const a = this.at(left, top)
        const b = this.at(right, bottom)
        const x = Math.min(a.x, b.x)
        const y = Math.min(a.y, b.y)
        return { x, y, width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) }
    }

    lift(height: number): number {
        return height * CELL * this.rise
    }

    // Nearer the viewer is larger; ties go left to right.
    depthOrder(a: Cell, b: Cell): number {
        const pa = this.centre(a)
        const pb = this.centre(b)
        return pa.y - pb.y || pa.x - pb.x
    }

    screenAxis(axis: Axis): Axis {
        if (this.quarterTurns % 2 === 0) return axis
        return axis === Axis.EastWest ? Axis.NorthSouth : Axis.EastWest
    }

    // The tallest piece standing on a cell, as screen height above its centre.
    get headroom(): number {
        return Math.max(this.lift(TIER_HEIGHT * 4), this.lift(BRIDGE_RISE) + PILLI_HEIGHT * 1.35)
    }

    private turn(column: number, row: number): [number, number] {
        switch (this.quarterTurns) {
            case 0:
                return [column, row]
            case 1:
                return [BOARD_HEIGHT - row, column]
            case 2:
                return [BOARD_WIDTH - column, BOARD_HEIGHT - row]
            case 3:
                return [row, BOARD_WIDTH - column]
        }
    }

    // Written as a translation and an offset-free matrix: Firefox leaves a matrix's offset out
    // of the board's CSS zoom.
    private makePlanTransform(): string {
        const origin = this.at(0, 0)
        const across = this.at(1, 0)
        const down = this.at(0, 1)
        const a = (across.x - origin.x) / CELL
        const b = (across.y - origin.y) / CELL
        const c = (down.x - origin.x) / CELL
        const d = (down.y - origin.y) / CELL
        return `translate(${origin.x} ${origin.y}) matrix(${a} ${b} ${c} ${d} 0 0)`
    }

    // Letters along the printed board's top edge and numbers along its left, turning with it.
    private makeLabels(): Label[] {
        const beyond = (plan: Point, outward: Point): Point => {
            const at = this.at(plan.x, plan.y)
            const away = this.at(plan.x + outward.x, plan.y + outward.y)
            const dx = Math.sign(Math.round(away.x - at.x))
            const dy = Math.sign(Math.round(away.y - at.y))
            const reach =
                dy < 0
                    ? this.headroom + LABEL_GAP + LABEL_REACH / 2
                    : LABEL_GAP + (dx === 0 ? LABEL_REACH / 2 : LABEL_REACH)
            return { x: at.x + dx * reach, y: at.y + dy * reach }
        }
        const letters = Array.from({ length: BOARD_WIDTH }, (_, column) => ({
            key: `column-${column}`,
            text: String.fromCharCode(65 + column),
            at: beyond({ x: column + 0.5, y: 0 }, { x: 0, y: -1 })
        }))
        const numbers = Array.from({ length: BOARD_HEIGHT }, (_, row) => ({
            key: `row-${row}`,
            text: String(row + 1),
            at: beyond({ x: 0, y: row + 0.5 }, { x: -1, y: 0 })
        }))
        return [...letters, ...numbers]
    }

    private makeFrame(): Box {
        const xs = this.labels.map((label) => label.at.x)
        const ys = this.labels.map((label) => label.at.y)
        const left = Math.min(0, ...xs.map((x) => x - LABEL_REACH)) - EDGE_MARGIN
        const right = Math.max(this.width, ...xs.map((x) => x + LABEL_REACH)) + EDGE_MARGIN
        const top = Math.min(-this.headroom, ...ys.map((y) => y - LABEL_REACH / 2)) - EDGE_MARGIN
        const bottom =
            Math.max(this.depth, ...ys.map((y) => y + LABEL_REACH / 2)) +
            EDGE_MARGIN +
            CONTROLS_ROOM
        return { x: left, y: top, width: right - left, height: bottom - top }
    }
}

const VIEWS = new Map<string, BoardView>()

export function boardView(flat: boolean, quarterTurns: QuarterTurns): BoardView {
    const key = `${flat}-${quarterTurns}`
    let view = VIEWS.get(key)
    if (view === undefined) {
        view = new BoardView(flat ? FLAT : TILT, quarterTurns)
        VIEWS.set(key, view)
    }
    return view
}

export function quarterTurnsOf(rotated: boolean, farSide: boolean): QuarterTurns {
    if (rotated) return farSide ? 3 : 1
    return farSide ? 2 : 0
}
