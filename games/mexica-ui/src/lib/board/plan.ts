import { BOARD_HEIGHT, BOARD_WIDTH } from '@tabletop/mexica'
import { CELL, type Box } from './view.js'

// The printed board seen from straight above, in board units.
export const PLAN: Box = { x: 0, y: 0, width: BOARD_WIDTH * CELL, height: BOARD_HEIGHT * CELL }
