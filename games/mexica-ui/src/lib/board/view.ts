import { BOARD_HEIGHT, BOARD_WIDTH, type Cell, columnOf, rowOf } from '@tabletop/mexica'

export const CELL = 40

export interface Point {
    x: number
    y: number
}

// The board seen from the near side of the table: depth squashed by the tilt, heights
// foreshortened by the angle. A tilt of 1 looks straight down.
export class BoardView {
    readonly rise: number

    constructor(readonly tilt: number) {
        this.rise = Math.sqrt(1 - tilt * tilt)
    }

    // A point on the board's plane, in cells from the top-left corner of the grid.
    at(column: number, row: number): Point {
        return { x: column * CELL, y: row * CELL * this.tilt }
    }

    centre(cell: Cell): Point {
        return this.at(columnOf(cell) + 0.5, rowOf(cell) + 0.5)
    }

    corner(cell: Cell): Point {
        return this.at(columnOf(cell), rowOf(cell))
    }

    // A height above the board, in units of a cell, as screen distance.
    lift(height: number): number {
        return height * CELL * this.rise
    }

    get width(): number {
        return BOARD_WIDTH * CELL
    }

    get depth(): number {
        return BOARD_HEIGHT * CELL * this.tilt
    }

    get cellDepth(): number {
        return CELL * this.tilt
    }
}

export const TILTED = new BoardView(0.75)
