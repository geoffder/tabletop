import type { Point } from '@tabletop/common'
import type { Cell } from '@tabletop/mexica'
import { palaceRise } from './palaceShape.js'
import { BRIDGE_RISE, type BoardView, CELL } from './view.js'

// Where a Pilli Mexica on `cell` stands on screen: centred on a bridge's deck, raised onto the
// palace, and otherwise a little forward of the cell's middle, clear of a token behind it.
export function pilliSpot(view: BoardView, cell: Cell, bridges: ReadonlySet<Cell>): Point {
    const centre = view.centre(cell)
    if (bridges.has(cell)) return { x: centre.x, y: centre.y - view.lift(BRIDGE_RISE) }
    return {
        x: centre.x,
        y: centre.y + CELL * 0.1 * view.tilt - view.lift(palaceRise(cell))
    }
}
