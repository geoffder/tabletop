import type { Point } from '@tabletop/common'
import { type Cell, cellAt, columnOf, isLand, rowOf } from '@tabletop/mexica'
import { SLOPE_WIDTH, type SlopeCorner, type SlopeSide } from './looks.js'
import { SHORE_ZONE } from './surfaceTexture.js'
import { type Box, CELL } from './view.js'
import { SPILL_VARIANTS, spillBox, type SpillKind } from './spillShape.js'
import { COVE_TOE, spillLook } from './looks.js'

// The island's built edges, in plan, for a set of canals.
//
// Each canal is banked in tezontle brick wherever it meets land. Where a canal opens into the
// lake, the square of lake in front of it is its mouth: banked like the canal, with quays along
// any land beside it. The island's shore is the stones and rocks beyond each square of land on
// its lake sides; a canal's square has none, and neither has a mouth. Where a shore is cut short
// beside a canal or a mouth, rocks spill over the cut onto the brick.

export type Spot = { column: number; row: number }

export type Bank = { key: string; slope: SlopeSide; points: string }
// A bend of bank in a corner of a water square: round a corner of land jutting into the water
// ('outside'), or a cove where two banks meet ('inside').
export type Curve = {
    key: string
    corner: SlopeCorner
    bend: 'outside' | 'inside'
    x: number
    y: number
    size: number
}
export type Spill = { key: string; look: string; box: Box }
export type Kerb = { key: string; stone: Box; edge: Box }
// Where two kerbs meet round a corner of land, a quarter round of kerb joins them.
export type KerbJoin = { key: string; points: string }
export type Zone = { key: string; points: string }

export type Waterworks = {
    banks: Bank[]
    curves: Curve[]
    spills: Spill[]
    kerbs: Kerb[]
    joins: KerbJoin[]
    zones: Zone[]
}

export const BANK_WIDTH = SLOPE_WIDTH
const KERB = { width: 2.6, line: 0.7 }
const SEAM = 0.5

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
        joins: waters.flatMap((spot) => joinsOf(island, spot)),
        zones: landCells.map(spotOf).flatMap((spot) => zonesOf(island, spot))
    }
}

// A water square's banks on every side where it meets land, mitred where two meet.
function banksOf(island: Island, spot: Spot): Bank[] {
    const banked = (side: SlopeSide) => island.ground(plus(spot, STEP[side]))
    const edges = edgesOf(spot)
    // Each bank stops short of an inside corner, where the cove takes over.
    const cove = BANK_WIDTH + COVE_TOE
    return SIDES.filter(banked).map((side) => {
        const [a, b] = edges[side]
        const inward = { x: -STEP[side].column, y: -STEP[side].row }
        const along = { x: (b.x - a.x) / CELL, y: (b.y - a.y) / CELL }
        const [before, after] = ENDS[side]
        const startA = offset(a, along, banked(before) ? cove : 0)
        const endB = offset(b, along, banked(after) ? -cove : 0)
        return {
            key: `bank-${keyOf(spot)}-${side}`,
            slope: side,
            points: shape([
                startA,
                endB,
                offset(endB, inward, BANK_WIDTH),
                offset(startA, inward, BANK_WIDTH)
            ])
        }
    })
}

// A curve of bank in the corner of a water square wherever the water runs on past both sides
// of that corner but the square across the corner is land, its corner jutting into the water;
// and a cove wherever the square meets land on both sides of a corner.
function curvesOf(island: Island, spot: Spot): Curve[] {
    const at = (corner: SlopeCorner, up: SlopeSide, beside: SlopeSide, bend: Curve['bend']) => {
        const size = bend === 'inside' ? BANK_WIDTH + COVE_TOE : BANK_WIDTH
        return {
            key: `curve-${keyOf(spot)}-${corner}`,
            corner,
            bend,
            x: spot.column * CELL + (beside === 'e' ? CELL - size : 0),
            y: spot.row * CELL + (up === 's' ? CELL - size : 0),
            size
        }
    }
    return CORNERS.flatMap(([corner, up, beside]) => {
        const across = plus(spot, plus(STEP[up], STEP[beside]))
        const above = plus(spot, STEP[up])
        const aside = plus(spot, STEP[beside])
        if (island.ground(above) && island.ground(aside)) return [at(corner, up, beside, 'inside')]
        if (island.water(above) && island.water(aside) && island.ground(across)) {
            return [at(corner, up, beside, 'outside')]
        }
        return []
    })
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
                // The brick runs back across the shore's end beside a canal or a mouth, and on
                // along the coast past it otherwise.
                const kind: SpillKind =
                    island.canal(beside) || island.mouth(beside) ? 'across' : 'along'
                const variant =
                    Math.abs(spot.column * 7 + spot.row * 13 + SIDES.indexOf(end)) % SPILL_VARIANTS
                const box = spillBox(side, end, kind, variant)
                spills.push({
                    key: `spill-${keyOf(spot)}-${side}-${end}`,
                    look: spillLook(side, end, kind, variant),
                    box: { ...box, x: box.x + corner.x, y: box.y + corner.y }
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

// Where a water square meets land on both sides of a corner and across it, the kerbs on either
// side each stop at the corner, leaving a notch of the square across between them: a quarter
// round of kerb about the corner fills it.
function joinsOf(island: Island, spot: Spot): KerbJoin[] {
    return CORNERS.flatMap(([corner, up, beside]) => {
        const across = plus(spot, plus(STEP[up], STEP[beside]))
        if (
            ![plus(spot, STEP[up]), plus(spot, STEP[beside]), across].every((near) =>
                island.ground(near)
            )
        )
            return []
        const point = cornerOf(spot, up, beside)
        const [a, b] = [toward(up), toward(beside)]
        const arc = Array.from({ length: 9 }, (_, index) => {
            const angle = (index / 8) * (Math.PI / 2)
            return {
                x: point.x + (a.x * Math.cos(angle) + b.x * Math.sin(angle)) * KERB.width,
                y: point.y + (a.y * Math.cos(angle) + b.y * Math.sin(angle)) * KERB.width
            }
        })
        return [{ key: `join-${keyOf(spot)}-${corner}`, points: shape([point, ...arc]) }]
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
    // Each square laps a little over its neighbours, or the seams between them let the lake
    // show through as hairlines.
    const lap = (corner: Point, x: number, y: number) => ({
        x: corner.x + x * SEAM,
        y: corner.y + y * SEAM
    })
    const square = {
        key: `zone-${keyOf(spot)}`,
        points: shape([lap(nw, -1, -1), lap(ne, 1, -1), lap(se, 1, 1), lap(sw, -1, 1)])
    }
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
