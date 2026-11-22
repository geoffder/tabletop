import type { Point } from '@tabletop/common'
import { Axis, BOARD_HEIGHT, BOARD_WIDTH, type Cell, columnOf, rowOf } from '@tabletop/mexica'

export const CELL = 40
export const TILT = 0.75
export const FLAT = 1

export const TIER_HEIGHT = 0.26
export const BRIDGE_RISE = 0.16
// A Pilli Mexica's height and how far its headdress reaches back, as shares of a cell, at its
// drawn size.
// A Pilli Mexica's height, and its width and depth, as multiples of the figure as drawn: tall
// enough to show behind a temple, slim enough to stand between a bridge's curbs.
export const PILLI_SIZE = 1.4
export const PILLI_WIDTH = 1.08
// To the top of its headdress, as a share of a cell.
export const PILLI_HEIGHT = 0.85 * PILLI_SIZE
export const PILLI_DEPTH = 0.24 * PILLI_WIDTH

// The coordinates' type size, in board units.
export const LABEL_SIZE = 18
export const LABEL_WEIGHT = 600
const LABEL_GAP = 4
const LABEL_REACH = LABEL_SIZE * 0.9
const EDGE_MARGIN = 4
// The lake reaches this far past the printed board's edge all round, so where the island's land
// runs to the edge its shore meets water, not the table.
export const LAKE_MARGIN = 14

export type Box = { x: number; y: number; width: number; height: number }

export type Label = { key: string; text: string; at: Point; anchor: 'start' | 'middle' | 'end' }

export type QuarterTurns = 0 | 1 | 2 | 3

export type PlanStep = { column: number; row: number }

const PLAN_STEPS: readonly PlanStep[] = [
    { column: 0, row: 1 },
    { column: 1, row: 0 },
    { column: 0, row: -1 },
    { column: -1, row: 0 }
]

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
    // Steps in plan columns and rows to the neighbouring cell just in front, and just to the
    // right, on screen.
    readonly nearer: PlanStep
    readonly rightward: PlanStep
    // Places plan coordinates in board units (a cell is CELL wide) on screen.
    readonly planTransform: string

    constructor(
        readonly tilt: number,
        readonly quarterTurns: QuarterTurns,
        // With the coordinates round it; without, the board takes their room.
        readonly labelled = true
    ) {
        this.rise = Math.sqrt(1 - tilt * tilt)
        this.flat = tilt === FLAT
        const sideways = quarterTurns % 2 === 1
        this.width = (sideways ? BOARD_HEIGHT : BOARD_WIDTH) * CELL
        this.depth = (sideways ? BOARD_WIDTH : BOARD_HEIGHT) * CELL * tilt
        this.planTransform = this.makePlanTransform()
        this.nearer = this.stepToward((point) => point.y)
        this.rightward = this.stepToward((point) => point.x)
        this.labels = labelled ? this.makeLabels() : []
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
        return Math.max(
            this.lift(TIER_HEIGHT * 4),
            this.lift(BRIDGE_RISE + PILLI_HEIGHT) + PILLI_DEPTH * CELL * this.tilt
        )
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

    private stepToward(measure: (point: Point) => number): PlanStep {
        const ahead = (step: PlanStep) =>
            measure(this.at(step.column, step.row)) - measure(this.at(0, 0))
        return PLAN_STEPS.reduce((best, step) => (ahead(step) > ahead(best) ? step : best))
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

    // Letters along the columns and numbers along the rows, each on whichever of its two edges
    // faces the bottom or the left of the screen, so neither has to clear the pieces standing
    // in the far row.
    private makeLabels(): Label[] {
        const screenWay = (plan: Point, outward: Point) => {
            const at = this.at(plan.x, plan.y)
            const away = this.at(plan.x + outward.x, plan.y + outward.y)
            return {
                dx: Math.sign(Math.round(away.x - at.x)),
                dy: Math.sign(Math.round(away.y - at.y))
            }
        }
        const nearer = (sides: [Point, Point][]) =>
            sides.find(([plan, outward]) => {
                const { dx, dy } = screenWay(plan, outward)
                return dy > 0 || dx < 0
            }) ?? sides[0]
        // Beside the board a label is aligned to its edge, at the gap; above or below it is
        // centred on its column.
        const beyond = (plan: Point, outward: Point): Pick<Label, 'at' | 'anchor'> => {
            const margin = LAKE_MARGIN / CELL
            const at = this.at(plan.x + outward.x * margin, plan.y + outward.y * margin)
            const { dx, dy } = screenWay(plan, outward)
            const reach = LABEL_GAP + (dx === 0 ? LABEL_REACH / 2 : 0)
            return {
                at: { x: at.x + dx * reach, y: at.y + dy * reach },
                anchor: dx < 0 ? 'end' : dx > 0 ? 'start' : 'middle'
            }
        }
        const [columnEdge, columnOut] = nearer([
            [
                { x: 0, y: BOARD_HEIGHT },
                { x: 0, y: 1 }
            ],
            [
                { x: 0, y: 0 },
                { x: 0, y: -1 }
            ]
        ])
        const [rowEdge, rowOut] = nearer([
            [
                { x: 0, y: 0 },
                { x: -1, y: 0 }
            ],
            [
                { x: BOARD_WIDTH, y: 0 },
                { x: 1, y: 0 }
            ]
        ])
        const letters = Array.from({ length: BOARD_WIDTH }, (_, column) => ({
            key: `column-${column}`,
            text: String.fromCharCode(65 + column),
            ...beyond({ x: column + 0.5, y: columnEdge.y }, columnOut)
        }))
        const numbers = Array.from({ length: BOARD_HEIGHT }, (_, row) => ({
            key: `row-${row}`,
            text: String(row + 1),
            ...beyond({ x: rowEdge.x, y: row + 0.5 }, rowOut)
        }))
        return [...letters, ...numbers]
    }

    private makeFrame(): Box {
        // How far each label reaches across, from where it is anchored.
        const extents = this.labels.map((label) => {
            const width = label.text.length * LABEL_SIZE * 0.62
            const left = label.anchor === 'end' ? width : label.anchor === 'middle' ? width / 2 : 0
            return { left: label.at.x - left, right: label.at.x - left + width, y: label.at.y }
        })
        const margin = LAKE_MARGIN / CELL
        const lake = this.planBox(-margin, -margin, BOARD_WIDTH + margin, BOARD_HEIGHT + margin)
        const left = Math.min(lake.x, ...extents.map((extent) => extent.left)) - EDGE_MARGIN
        const right =
            Math.max(lake.x + lake.width, ...extents.map((extent) => extent.right)) + EDGE_MARGIN
        const top =
            Math.min(
                -this.headroom,
                lake.y,
                ...extents.map((extent) => extent.y - LABEL_REACH / 2)
            ) - EDGE_MARGIN
        const bottom =
            Math.max(lake.y + lake.height, ...extents.map((extent) => extent.y + LABEL_REACH / 2)) +
            EDGE_MARGIN
        return { x: left, y: top, width: right - left, height: bottom - top }
    }

    // The frame with room below it for the controls laid over the board's foot, `controls`
    // screen pixels tall when the board is fitted into `space`: the fewer pixels a board unit
    // gets, the more units the controls take.
    frameWithControls(space: { width: number; height: number } | undefined, controls: number): Box {
        const frame = this.frame
        if (space === undefined || space.width <= 0 || space.height <= controls) {
            return { ...frame, height: frame.height + controls }
        }
        const scale = Math.min(space.width / frame.width, (space.height - controls) / frame.height)
        return { ...frame, height: frame.height + controls / scale }
    }
}

const VIEWS = new Map<string, BoardView>()

export function boardView(flat: boolean, quarterTurns: QuarterTurns, labelled = true): BoardView {
    const key = `${flat}-${quarterTurns}-${labelled}`
    let view = VIEWS.get(key)
    if (view === undefined) {
        view = new BoardView(flat ? FLAT : TILT, quarterTurns, labelled)
        VIEWS.set(key, view)
    }
    return view
}

export function quarterTurnsOf(rotated: boolean, farSide: boolean): QuarterTurns {
    if (rotated) return farSide ? 3 : 1
    return farSide ? 2 : 0
}
