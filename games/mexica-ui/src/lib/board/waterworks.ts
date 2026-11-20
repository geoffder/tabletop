import type { Point } from '@tabletop/common'
import { type Cell, cellAt, columnOf, isLand, rowOf } from '@tabletop/mexica'
import { SLOPE_WIDTH, type SlopeCorner, type SlopeSide } from './looks.js'
import { SHORE_ZONE } from './surfaceTexture.js'
import { CELL } from './view.js'

// The island's built edges, in plan, for a set of canals.
//
// Each canal is banked in tezontle brick wherever it meets land. Where a canal opens into the
// lake, the square of lake in front of it is its mouth: banked like the canal, with quays along
// any land beside it. The island's shore is the stones and rocks beyond each square of land on
// its lake sides; a canal's square has none, and neither has a mouth. Where a shore is cut short
// beside a canal or a mouth, rocks spill over the cut onto the brick.

export type Spot = { column: number; row: number }

export type Bank = { key: string; slope: SlopeSide; points: string }
export type Curve = { key: string; corner: SlopeCorner; x: number; y: number }
export type Spill = { key: string; side: SlopeSide; variant: number; x: number; y: number }
export type Kerb = { key: string; stone: Box; edge: Box }
export type Zone = { key: string; points: string }
type Box = { x: number; y: number; width: number; height: number }

export type Waterworks = {
    banks: Bank[]
    curves: Curve[]
    spills: Spill[]
    kerbs: Kerb[]
    zones: Zone[]
}

export const BANK_WIDTH = SLOPE_WIDTH
// How far out from the land a spill of rocks reaches.
export const SPILL_REACH = 16
const SPILL_WIDE = SPILL_REACH * 0.4
// The box of a spill's image round its centre, as renderSpill draws it.
export const SPILL_BOX: Record<SlopeSide, { width: number; height: number }> = {
    n: { width: SPILL_WIDE * 2 + 6, height: SPILL_REACH + 6 },
    s: { width: SPILL_WIDE * 2 + 6, height: SPILL_REACH + 6 },
    e: { width: SPILL_REACH + 6, height: SPILL_WIDE * 2 + 6 },
    w: { width: SPILL_REACH + 6, height: SPILL_WIDE * 2 + 6 }
}
const KERB = { width: 2.6, line: 0.7 }

export const SIDES: readonly SlopeSide[] = ['n', 'e', 's', 'w']
const STEP: Record<SlopeSide, Spot> = {
    n: { column: 0, row: -1 },
    e: { column: 1, row: 0 },
    s: { column: 0, row: 1 },
    w: { column: -1, row: 0 }
}
// Each side's ends, clockwise, and the sides it meets at them.
const ENDS: Record<SlopeSide, [SlopeSide, SlopeSide]> = {
    n: ['w', 'e'],
    e: ['n', 's'],
    s: ['e', 'w'],
    w: ['s', 'n']
}
const CORNERS: readonly [SlopeCorner, SlopeSide, SlopeSide][] = [
    ['ne', 'n', 'e'],
    ['nw', 'n', 'w'],
    ['se', 's', 'e'],
    ['sw', 's', 'w']
]

const plus = (a: Spot, b: Spot): Spot => ({ column: a.column + b.column, row: a.row + b.row })
const toward = (side: SlopeSide): Point => ({ x: STEP[side].column, y: STEP[side].row })
const offset = (from: Point, way: Point, by: number): Point => ({
    x: from.x + way.x * by,
    y: from.y + way.y * by
})
const shape = (points: Point[]) => points.map((p) => `${p.x},${p.y}`).join(' ')
const keyOf = (spot: Spot) => `${spot.column},${spot.row}`

// The corners of a spot and its edges, each clockwise.
function edgesOf(spot: Spot): Record<SlopeSide, [Point, Point]> {
    const x0 = spot.column * CELL
    const y0 = spot.row * CELL
    const nw = { x: x0, y: y0 }
    const ne = { x: x0 + CELL, y: y0 }
    const se = { x: x0 + CELL, y: y0 + CELL }
    const sw = { x: x0, y: y0 + CELL }
    return { n: [nw, ne], e: [ne, se], s: [se, sw], w: [sw, nw] }
}

function cornerOf(spot: Spot, side: SlopeSide, end: SlopeSide): Point {
    const [a, b] = edgesOf(spot)[side]
    return ENDS[side][0] === end ? a : b
}

class Island {
    constructor(private readonly canals: ReadonlySet<Cell>) {}

    cell(spot: Spot): Cell | undefined {
        return cellAt(spot.column, spot.row)
    }

    land(spot: Spot): boolean {
        const cell = this.cell(spot)
        return cell !== undefined && isLand(cell)
    }

    canal(spot: Spot): boolean {
        const cell = this.cell(spot)
        return cell !== undefined && this.canals.has(cell)
    }

    // Land that is not a canal: banked where it meets water, with a shore on the lake.
    ground(spot: Spot): boolean {
        return this.land(spot) && !this.canal(spot)
    }

    lake(spot: Spot): boolean {
        return !this.land(spot)
    }

    // A square of lake on the board in front of a canal.
    mouth(spot: Spot): boolean {
        return (
            this.lake(spot) &&
            this.cell(spot) !== undefined &&
            SIDES.some((side) => this.canal(plus(spot, STEP[side])))
        )
    }

    water(spot: Spot): boolean {
        return this.canal(spot) || this.mouth(spot)
    }
}

export function waterworks(landCells: readonly Cell[], canals: ReadonlySet<Cell>): Waterworks {
    const island = new Island(canals)
    const spotOf = (cell: Cell): Spot => ({ column: columnOf(cell), row: rowOf(cell) })
    const waters: Spot[] = []
    const seen = new Set<string>()
    for (const cell of canals) {
        const spot = spotOf(cell)
        for (const near of [spot, ...SIDES.map((side) => plus(spot, STEP[side]))]) {
            if (island.water(near) && !seen.has(keyOf(near))) {
                seen.add(keyOf(near))
                waters.push(near)
            }
        }
    }
    const grounds = landCells.map(spotOf).filter((spot) => island.ground(spot))
    return {
        banks: waters.flatMap((spot) => banksOf(island, spot)),
        curves: waters.flatMap((spot) => curvesOf(island, spot)),
        spills: spillsOf(island, grounds),
        kerbs: grounds.flatMap((spot) => kerbsOf(island, spot)),
        zones: landCells.map(spotOf).flatMap((spot) => zonesOf(island, spot))
    }
}

// A water square's banks on every side where it meets land, mitred where two meet.
function banksOf(island: Island, spot: Spot): Bank[] {
    const banked = (side: SlopeSide) => island.ground(plus(spot, STEP[side]))
    const edges = edgesOf(spot)
    return SIDES.filter(banked).map((side) => {
        const [a, b] = edges[side]
        const inward = { x: -STEP[side].column, y: -STEP[side].row }
        const along = { x: (b.x - a.x) / CELL, y: (b.y - a.y) / CELL }
        const [before, after] = ENDS[side]
        const innerA = offset(offset(a, inward, BANK_WIDTH), along, banked(before) ? BANK_WIDTH : 0)
        const innerB = offset(offset(b, inward, BANK_WIDTH), along, banked(after) ? -BANK_WIDTH : 0)
        return {
            key: `bank-${keyOf(spot)}-${side}`,
            slope: side,
            points: shape([a, b, innerB, innerA])
        }
    })
}

// A curve of bank in the corner of a water square wherever the water runs on past both sides
// of that corner but the square across the corner is land, its corner jutting into the water.
function curvesOf(island: Island, spot: Spot): Curve[] {
    return CORNERS.filter(([, up, beside]) => {
        const across = plus(spot, plus(STEP[up], STEP[beside]))
        return (
            island.water(plus(spot, STEP[up])) &&
            island.water(plus(spot, STEP[beside])) &&
            island.ground(across)
        )
    }).map(([corner, up, beside]) => ({
        key: `curve-${keyOf(spot)}-${corner}`,
        corner,
        x: spot.column * CELL + (beside === 'e' ? CELL - BANK_WIDTH : 0),
        y: spot.row * CELL + (up === 's' ? CELL - BANK_WIDTH : 0)
    }))
}

// Wherever a square's shore on the lake is cut short, by a canal or a canal's mouth beside it,
// rocks spill over the cut and onto the end of the brick there, so the stone runs into the
// brick rather than stopping at it.
function spillsOf(island: Island, grounds: readonly Spot[]): Spill[] {
    const spills: Spill[] = []
    for (const spot of grounds) {
        for (const side of SIDES) {
            const host = plus(spot, STEP[side])
            if (island.cell(host) === undefined || !island.lake(host) || island.mouth(host))
                continue
            for (const end of ENDS[side]) {
                const beside = plus(spot, STEP[end])
                const across = plus(host, STEP[end])
                const cut = island.land(across)
                    ? !island.ground(across)
                    : island.ground(beside)
                      ? island.mouth(across)
                      : island.canal(beside) || island.mouth(beside)
                if (!cut) continue
                const corner = cornerOf(spot, side, end)
                const centre = offset(
                    offset(corner, toward(side), SPILL_REACH / 2),
                    toward(end),
                    1.5
                )
                const variant = Math.abs(spot.column * 7 + spot.row * 13 + SIDES.indexOf(end)) % 3
                spills.push({
                    key: `spill-${keyOf(spot)}-${side}-${end}`,
                    side,
                    variant,
                    x: centre.x,
                    y: centre.y
                })
            }
        }
    }
    return spills
}

// A kerb along every edge where a square of land meets water.
function kerbsOf(island: Island, spot: Spot): Kerb[] {
    return SIDES.filter((side) => island.water(plus(spot, STEP[side]))).map((side) => {
        const left = spot.column * CELL
        const top = spot.row * CELL
        const step = STEP[side]
        const across = step.column !== 0
        const far = step.column > 0 || step.row > 0
        const strip = (width: number): Box => {
            const at = far ? CELL - width : 0
            return across
                ? { x: left + at, y: top, width, height: CELL }
                : { x: left, y: top + at, width: CELL, height: width }
        }
        return {
            key: `kerb-${keyOf(spot)}-${side}`,
            stone: strip(KERB.width),
            edge: strip(KERB.line)
        }
    })
}

// A square of land as drawn, and beyond it, unless it is a canal, its shore on each side it
// meets the lake: up to the diagonal where the coast turns an inside corner and another
// square's shore takes over, and round its corners where it meets the lake on both sides. No
// shore lies in a mouth.
function zonesOf(island: Island, spot: Spot): Zone[] {
    const edges = edgesOf(spot)
    const [nw, ne] = edges.n
    const [se, sw] = edges.s
    const square = { key: `zone-${keyOf(spot)}`, points: shape([nw, ne, se, sw]) }
    if (!island.ground(spot)) return [square]
    const reach = SHORE_ZONE
    const pieces = SIDES.filter((side) => {
        const host = plus(spot, STEP[side])
        return island.lake(host) && !island.mouth(host)
    }).flatMap((side) => {
        const out = toward(side)
        const host = plus(spot, STEP[side])
        const [a, b] = edges[side]
        const [before, after] = ENDS[side]
        const farEnd = (corner: Point, end: SlopeSide) => {
            const far = offset(corner, out, reach)
            return island.land(plus(host, STEP[end])) ? offset(far, toward(end), -reach) : far
        }
        const strip = shape([a, b, farEnd(b, after), farEnd(a, before)])
        const rounds = [before, after]
            .filter((end) => {
                const beside = plus(spot, STEP[end])
                return island.lake(beside) && !island.mouth(beside)
            })
            .map((end) => {
                const corner = end === before ? a : b
                const sideways = offset(corner, toward(end), reach)
                return shape([
                    corner,
                    sideways,
                    offset(sideways, out, reach),
                    offset(corner, out, reach)
                ])
            })
        return [strip, ...rounds]
    })
    return [
        square,
        ...pieces.map((points, index) => ({ key: `zone-${keyOf(spot)}-${index}`, points }))
    ]
}
