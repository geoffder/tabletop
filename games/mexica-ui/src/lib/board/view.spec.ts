import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import { Axis, BOARD_HEIGHT, BOARD_WIDTH, CELL_COUNT, cellAt } from '@tabletop/mexica'
import { boardView, CELL, type QuarterTurns } from './view.js'

const TURNS: readonly QuarterTurns[] = [0, 1, 2, 3]
const CELLS = Array.from({ length: CELL_COUNT }, (_, cell) => cell)
const corner = cellAt(0, 0)
assertExists(corner, 'The board has a top-left cell')

describe('BoardView', () => {
    it('turns the printed top-left corner clockwise round the board', () => {
        const box = (turns: QuarterTurns) => boardView(true, turns).cellBox(corner)
        const last = (turns: QuarterTurns) => boardView(true, turns)
        expect(box(0)).toMatchObject({ x: 0, y: 0 })
        expect(box(1)).toMatchObject({ x: last(1).width - CELL, y: 0 })
        expect(box(2)).toMatchObject({ x: last(2).width - CELL, y: last(2).depth - CELL })
        expect(box(3)).toMatchObject({ x: 0, y: last(3).depth - CELL })
    })

    it('sees the far side as two quarter turns', () => {
        for (const flat of [false, true]) {
            const half = boardView(flat, 2)
            const back = boardView(flat, 0)
            for (const cell of CELLS) {
                const turned = half.centre(cell)
                const plain = back.centre(cell)
                expect(turned.x).toBeCloseTo(back.width - plain.x)
                expect(turned.y).toBeCloseTo(back.depth - plain.y)
            }
        }
    })

    it('swaps the screen axis of a bridge on a quarter turn only', () => {
        expect(boardView(false, 0).screenAxis(Axis.EastWest)).toBe(Axis.EastWest)
        expect(boardView(false, 1).screenAxis(Axis.EastWest)).toBe(Axis.NorthSouth)
        expect(boardView(false, 2).screenAxis(Axis.NorthSouth)).toBe(Axis.NorthSouth)
        expect(boardView(false, 3).screenAxis(Axis.NorthSouth)).toBe(Axis.EastWest)
    })

    it('frames every cell, the tallest piece and every label in each view', () => {
        for (const flat of [false, true]) {
            for (const turns of TURNS) {
                const view = boardView(flat, turns)
                const { frame } = view
                const inside = (x: number, y: number) =>
                    x >= frame.x &&
                    x <= frame.x + frame.width &&
                    y >= frame.y &&
                    y <= frame.y + frame.height
                for (const cell of CELLS) {
                    const box = view.cellBox(cell)
                    expect(inside(box.x, box.y - view.headroom)).toBe(true)
                    expect(inside(box.x + box.width, box.y + box.height)).toBe(true)
                }
                for (const label of view.labels) expect(inside(label.at.x, label.at.y)).toBe(true)
                expect(view.labels).toHaveLength(BOARD_WIDTH + BOARD_HEIGHT)
            }
        }
    })
})
