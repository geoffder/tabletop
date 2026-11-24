import type { Cell } from './board.js'
import type { Layout } from './layout.js'

export interface Route {
    cost: number
    // Every cell the Pilli Mexica passes, from where it stood to where it stops, bridges passed
    // under included.
    path: Cell[]
}

// The fewest action points on foot and by boat from `from` to every cell it reaches, `from`
// included at 0, with the cell each was reached from. A bridge with another Pilli Mexica on it
// can be passed under, never stopped on.
export function reachedFrom(
    layout: Layout,
    from: Cell
): Map<Cell, { cost: number; previous: Cell }> {
    const reached = new Map([[from, { cost: 0, previous: from }]])
    const queue = [from]
    for (let next = 0; next < queue.length; next++) {
        const cell = queue[next]
        const cost = (reached.get(cell)?.cost ?? 0) + 1
        const passingUnder = cell !== from && layout.pillis.has(cell)
        for (const step of layout.steps(cell)) {
            if (passingUnder && !step.byBoat) continue
            if (reached.has(step.cell)) continue
            reached.set(step.cell, { cost, previous: cell })
            queue.push(step.cell)
        }
    }
    return reached
}

// Whether the Pilli Mexica on `from` can stop on the cell: one not taken by another.
export const canStop = (layout: Layout, from: Cell, cell: Cell) =>
    cell === from || !layout.pillis.has(cell)

// The cheapest way on foot and by boat to every cell the Pilli Mexica on `from` can stop on.
export function routesFrom(layout: Layout, from: Cell): Map<Cell, Route> {
    const reached = reachedFrom(layout, from)
    const routes = new Map<Cell, Route>()
    for (const [cell, { cost }] of reached) {
        if (cell === from || !canStop(layout, from, cell)) continue
        const path = [cell]
        for (let at = cell; at !== from;) {
            at = reached.get(at)?.previous ?? from
            path.push(at)
        }
        routes.set(cell, { cost, path: path.reverse() })
    }
    return routes
}
