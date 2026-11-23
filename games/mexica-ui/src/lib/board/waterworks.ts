import type { Point } from '@tabletop/common'
import { type Cell, cellAt, columnOf, isLand, rowOf } from '@tabletop/mexica'
import { SLOPE_WIDTH, type SlopeCorner, type SlopeSide } from './looks.js'
import { SHORE_ZONE, shoreDepth } from './surfaceTexture.js'
import { type Box, CELL } from './view.js'
import { spillBox, spillDepth, type SpillKind } from './spillShape.js'
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
export type KerbJoin = { key: string; stone: string; edge: string }
export type Zone = { key: string; points: string }

export type Waterworks = {
    // The water's surface over the banks' feet, in canals and in their mouths in the lake, each
    // as one path: see waterSurface.
    surface: string
    mouthSurface: string
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

// The board asks again whenever its drawn state is replaced, which is mostly over the same
// canals (twice as a game opens); it gets the same works back, so nothing drawn from them changes.
let last: { landCells: readonly Cell[]; key: string; works: Waterworks } | undefined

export function lastWaterworks(
    landCells: readonly Cell[],
    canals: ReadonlySet<Cell>,
    filling: ReadonlySet<Cell> = new Set()
): Waterworks {
    const sorted = (cells: ReadonlySet<Cell>) => [...cells].sort((a, b) => a - b).join()
    const key = `${sorted(canals)}|${sorted(filling)}`
    if (last === undefined || last.landCells !== landCells || last.key !== key) {
        last = { landCells, key, works: waterworks(landCells, canals, filling) }
    }
    return last.works
}

// `filling` are canal squares the water is still running into: their surface is drawn with the
// water as it comes (surfaceOf), not here.
export function waterworks(
    landCells: readonly Cell[],
    canals: ReadonlySet<Cell>,
    filling: ReadonlySet<Cell> = new Set()
): Waterworks {
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
    // Open lake beside the water, where brick may round a corner of land between two waters.
    const open: Spot[] = []
    for (const spot of waters) {
        for (const side of SIDES) {
            const near = plus(spot, STEP[side])
            if (island.lake(near) && !island.water(near) && !seen.has(keyOf(near))) {
                seen.add(keyOf(near))
                open.push(near)
            }
        }
    }
    return {
        surface: waters
            .filter((spot) => {
                const cell = island.cell(spot)
                return island.canal(spot) && (cell === undefined || !filling.has(cell))
            })
            .map((spot) => waterSurface(island, spot))
            .join(''),
        mouthSurface: waters
            .filter((spot) => island.mouth(spot))
            .map((spot) => waterSurface(island, spot))
            .join(''),
        banks: waters.flatMap((spot) => banksOf(island, spot)),
        curves: [
            ...waters.flatMap((spot) => curvesOf(island, spot)),
            ...open.flatMap((spot) => curvesOf(island, spot, false))
        ],
        spills: spillsOf(island, grounds),
        kerbs: grounds.flatMap((spot) => kerbsOf(island, spot)),
        joins: waters.flatMap((spot) => joinsOf(island, spot)),
        zones: landCells.map(spotOf).flatMap((spot) => zonesOf(island, spot))
    }
}

// The water's surface in these canal squares, as one path.
export function surfaceOf(canals: ReadonlySet<Cell>, cells: readonly Cell[]): string {
    const island = new Island(canals)
    return cells
        .map((cell) => waterSurface(island, { column: columnOf(cell), row: rowOf(cell) }))
        .join('')
}

// How much of each bank stands dry above the water, from its top: the rest, down to its foot,
// lies under the water, seen through it.
export const DRY_BANK = 4
// A cove's course rounds its corner by this much at the bank's top, and by COVE_TOE at its foot.
const COVE_TOP_ROUND = 4

// A water square's surface: the square, kept DRY_BANK back from the land beside it, and
// rounded as the bank's course is there: in a cove; round a corner of land jutting into the
// water; square where two banks meet in a mitre. It laps a little into the water beside it, and
// the squares together make one path, so no seams open between them.
function waterSurface(island: Island, spot: Spot): string {
    const dry = DRY_BANK
    const lap = SEAM
    const banked = (side: SlopeSide) => island.ground(plus(spot, STEP[side]))
    const inset = (side: SlopeSide) => (banked(side) ? dry : -lap)
    const x0 = spot.column * CELL + inset('w')
    const y0 = spot.row * CELL + inset('n')
    const x1 = (spot.column + 1) * CELL - inset('e')
    const y1 = (spot.row + 1) * CELL - inset('s')
    const cove = COVE_TOP_ROUND + ((COVE_TOE - COVE_TOP_ROUND) * dry) / BANK_WIDTH
    // Each corner clockwise from the top left: its point, the ways in and out along the edges.
    const corners: [SlopeSide, SlopeSide, Point, Point, Point][] = [
        ['n', 'w', { x: x0, y: y0 }, { x: 0, y: -1 }, { x: 1, y: 0 }],
        ['n', 'e', { x: x1, y: y0 }, { x: 1, y: 0 }, { x: 0, y: 1 }],
        ['s', 'e', { x: x1, y: y1 }, { x: 0, y: 1 }, { x: -1, y: 0 }],
        ['s', 'w', { x: x0, y: y1 }, { x: -1, y: 0 }, { x: 0, y: -1 }]
    ]
    const parts = corners.map(([up, beside, at, into, out]) => {
        const across = island.ground(plus(spot, plus(STEP[up], STEP[beside])))
        const coved = banked(up) && banked(beside) && across
        const jutting = !banked(up) && !banked(beside) && across
        if (coved) {
            const a = offset(at, into, -cove)
            const b = offset(at, out, cove)
            return `L${a.x} ${a.y}A${cove} ${cove} 0 0 1 ${b.x} ${b.y}`
        }
        if (jutting) {
            // The land's corner lies `lap` beyond this one, outward on both edges.
            const land = offset(offset(at, into, -lap), out, lap)
            const r = dry
            const a = offset(land, into, -r)
            const b = offset(land, out, r)
            return `L${a.x} ${a.y}A${r} ${r} 0 0 0 ${b.x} ${b.y}`
        }
        return `L${at.x} ${at.y}`
    })
    return `M${x0} ${(y0 + y1) / 2}${parts.join('')}Z`
}

// A water square's banks on every side where it meets land, mitred where two meet.
function banksOf(island: Island, spot: Spot): Bank[] {
    const banked = (side: SlopeSide) => island.ground(plus(spot, STEP[side]))
    const edges = edgesOf(spot)
    // Each bank stops short of an inside corner, where the cove takes over; at a pinch, where
    // the land on the two sides touches only at the corner, the banks meet in a mitre instead.
    const cove = BANK_WIDTH + COVE_TOE
    const pinch = (side: SlopeSide, end: SlopeSide) =>
        !island.ground(plus(spot, plus(STEP[side], STEP[end])))
    return SIDES.filter(banked).map((side) => {
        const [a, b] = edges[side]
        const inward = { x: -STEP[side].column, y: -STEP[side].row }
        const along = { x: (b.x - a.x) / CELL, y: (b.y - a.y) / CELL }
        const [before, after] = ENDS[side]
        // Of the two banks at a mitre, the first drawn runs square into the corner and the
        // second is mitred over it, so no seam opens along the mitre.
        const mitred = (end: SlopeSide) =>
            banked(end) && pinch(side, end) && SIDES.indexOf(side) > SIDES.indexOf(end)
        const mitreA = mitred(before)
        const mitreB = mitred(after)
        const coved = (end: SlopeSide) => banked(end) && !pinch(side, end)
        const startA = offset(a, along, coved(before) ? cove : 0)
        const endB = offset(b, along, coved(after) ? -cove : 0)
        return {
            key: `bank-${keyOf(spot)}-${side}`,
            slope: side,
            points: shape([
                startA,
                endB,
                offset(offset(endB, inward, BANK_WIDTH), along, mitreB ? -BANK_WIDTH : 0),
                offset(offset(startA, inward, BANK_WIDTH), along, mitreA ? BANK_WIDTH : 0)
            ])
        }
    })
}

// A curve of bank in the corner of a water square wherever the water runs on past both sides
// of that corner but the square across the corner is land, its corner jutting into the water;
// and a cove wherever the square meets land on both sides of a corner. A square of open lake,
// not `banked`, takes only the curve: round land between a canal's mouth and another's, say.
function curvesOf(island: Island, spot: Spot, banked = true): Curve[] {
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
        if (banked && island.ground(above) && island.ground(aside) && island.ground(across)) {
            return [at(corner, up, beside, 'inside')]
        }
        if (island.water(above) && island.water(aside) && island.ground(across)) {
            return [at(corner, up, beside, 'outside')]
        }
        return []
    })
}

// Wherever a square's shore on the lake is cut short, by a canal or a canal's mouth beside it,
// its rocks slide over the cut and down the brick there, so the stone runs into the brick
// rather than stopping at it. The lake past the board's edge is lake like any other.
function spillsOf(island: Island, grounds: readonly Spot[]): Spill[] {
    const spills: Spill[] = []
    for (const spot of grounds) {
        for (const side of SIDES) {
            const host = plus(spot, STEP[side])
            if (!island.lake(host) || island.mouth(host)) continue
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
                // Long enough to hide the shore's end, out to where it stops along the cut.
                const back = toward(end)
                const out = toward(side)
                const reach = (behind: number) => {
                    let by = 0
                    while (
                        by < SHORE_ZONE &&
                        by <
                            shoreDepth(
                                corner.x - back.x * behind + out.x * by,
                                corner.y - back.y * behind + out.y * by
                            )
                    )
                        by += 0.5
                    return by
                }
                const depth = spillDepth(Math.max(...[0.5, 2, 4].map(reach)))
                const box = spillBox(side, end, kind, depth)
                spills.push({
                    key: `spill-${keyOf(spot)}-${side}-${end}`,
                    look: spillLook(side, end, kind, depth),
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
// round of kerb about the corner fills it, its edge rounding the corner with it.
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
        const round = (radius: number) =>
            shape([
                point,
                ...Array.from({ length: 9 }, (_, index) => {
                    const angle = (index / 8) * (Math.PI / 2)
                    return {
                        x: point.x + (a.x * Math.cos(angle) + b.x * Math.sin(angle)) * radius,
                        y: point.y + (a.y * Math.cos(angle) + b.y * Math.sin(angle)) * radius
                    }
                })
            ])
        return [
            {
                key: `join-${keyOf(spot)}-${corner}`,
                stone: round(KERB.width),
                edge: round(KERB.line)
            }
        ]
    })
}

// A square of land as drawn, and beyond it its shore on each side it meets the lake: up to the
// diagonal where the coast turns an inside corner and another square's shore takes over, and
// round its corners where it meets the lake on both sides. No shore lies in a mouth.
function zonesOf(island: Island, spot: Spot): Zone[] {
    // A canal's water covers its square; paving lapping out of it past the water's own edge
    // would show at the lake as a hairline.
    if (island.canal(spot)) return []
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
