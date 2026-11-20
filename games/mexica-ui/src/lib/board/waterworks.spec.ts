import { describe, expect, it } from 'vitest'
import { type Cell, cellAt, columnOf, isLand, LAND_CELLS, rowOf } from '@tabletop/mexica'
import { waterworks } from './waterworks.js'
import { CELL } from './view.js'

const landAt = (column: number, row: number) => {
    const cell = cellAt(column, row)
    return cell !== undefined && isLand(cell)
}

// A square of land on the north coast with land either side of it, also on the coast.
function northCoastBetweenLand(): Cell {
    const found = LAND_CELLS.find((cell) => {
        const [column, row] = [columnOf(cell), rowOf(cell)]
        return (
            row > 0 &&
            !landAt(column, row - 1) &&
            landAt(column - 1, row) &&
            landAt(column + 1, row) &&
            !landAt(column - 1, row - 1) &&
            !landAt(column + 1, row - 1) &&
            landAt(column, row + 1)
        )
    })
    if (found === undefined) throw new Error('No such square on the board')
    return found
}

describe('waterworks', () => {
    it("spills rocks over the shore cut short either side of a canal's mouth", () => {
        const canal = northCoastBetweenLand()
        const works = waterworks(LAND_CELLS, new Set([canal]))
        expect(works.spills).toHaveLength(2)
        const top = rowOf(canal) * CELL
        for (const spill of works.spills) expect(spill.y).toBeLessThan(top)
    })

    it('leaves no shore in the mouth of a canal', () => {
        const canal = northCoastBetweenLand()
        const works = waterworks(LAND_CELLS, new Set([canal]))
        const [left, right] = [columnOf(canal) * CELL, (columnOf(canal) + 1) * CELL]
        const top = rowOf(canal) * CELL
        const inMouth = works.zones.some((zone) =>
            zone.points.split(' ').some((point) => {
                const [x, y] = point.split(',').map(Number)
                return x > left + 0.5 && x < right - 0.5 && y < top - 0.5
            })
        )
        expect(inMouth).toBe(false)
    })

    it('banks a canal on every side it meets land, and builds nothing without canals', () => {
        const canal = northCoastBetweenLand()
        const works = waterworks(LAND_CELLS, new Set([canal]))
        expect(works.banks.filter((bank) => bank.key.startsWith('bank-'))).toHaveLength(3)
        const none = waterworks(LAND_CELLS, new Set())
        expect(none.banks).toHaveLength(0)
        expect(none.spills).toHaveLength(0)
    })
})
