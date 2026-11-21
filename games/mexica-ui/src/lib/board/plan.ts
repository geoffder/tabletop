import { BOARD_HEIGHT, BOARD_WIDTH } from '@tabletop/mexica'
import { CELL, type Box, LAKE_MARGIN } from './view.js'

// The printed board seen from straight above, in board units.
export const PLAN: Box = { x: 0, y: 0, width: BOARD_WIDTH * CELL, height: BOARD_HEIGHT * CELL }

// The lake, reaching past the printed board's edge all round.
export const WATERS: Box = {
    x: -LAKE_MARGIN,
    y: -LAKE_MARGIN,
    width: PLAN.width + 2 * LAKE_MARGIN,
    height: PLAN.height + 2 * LAKE_MARGIN
}
