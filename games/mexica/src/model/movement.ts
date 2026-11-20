import type { Cell } from './board.js'
import type { Layout } from './layout.js'

export interface Route {
    cost: number
    // Every cell the Pilli Mexica passes, from where it stood to where it stops, bridges passed
    // under included.
    path: Cell[]
}

// The cheapest way on foot and by boat to every cell the Pilli Mexica on `from` can stop on.
// A bridge with another Pilli Mexica on it can be passed under, never stopped on.
export function routesFrom(layout: Layout, from: Cell): Map<Cell, Route> {
    const previous = new Map<Cell, Cell>([[from, from]])
    const cost = new Map<Cell, number>([[from, 0]])
    const queue = [from]
    while (queue.length > 0) {
        const cell = queue.shift()
        if (cell === undefined) break
        const passingUnder = cell !== from && layout.pillis.has(cell)
        for (const step of layout.steps(cell)) {
            if (passingUnder && !step.byBoat) continue
            if (cost.has(step.cell)) continue
            cost.set(step.cell, (cost.get(cell) ?? 0) + 1)
            previous.set(step.cell, cell)
            queue.push(step.cell)
        }
    }
    const routes = new Map<Cell, Route>()
    for (const [cell, steps] of cost) {
        if (cell === from || layout.pillis.has(cell)) continue
        const path = [cell]
        while (path[0] !== from) path.unshift(previous.get(path[0]) ?? from)
        routes.set(cell, { cost: steps, path })
    }
    return routes
}
