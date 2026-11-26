import {
    pieceColor,
    pieceSize,
    PYRAMID_COLORS,
    PYRAMID_SIZES,
    PyramidColor,
    PyramidSize,
    type Ship,
    type StarSystem
} from '@tabletop/homeworlds'
import type { Point } from '@tabletop/common'
import { PYRAMID_BASE, PYRAMID_HEIGHT, shipFootprint } from './pyramid.js'
import { onTable, type BoardView } from './view.js'
import { convexNear, hull } from './hull.js'

// Where everything stands on the table, in table units: x right, y away from the near side.
export type StarPlacement = { piece: number; x: number; y: number; lift: number; yaw: number }
export type ShipPlacement = Ship & { x: number; y: number; heading: number }

export type SystemPlacement = {
    id: number
    x: number
    y: number
    stars: StarPlacement[]
    ships: ShipPlacement[]
    // The ring round the system on the table, as a loop of table points.
    outline: Point[]
    homeworldOf?: string
}

export type TowerPlacement = { color: PyramidColor; size: PyramidSize; x: number; y: number }

export type TableLayout = {
    systems: SystemPlacement[]
    towers: TowerPlacement[]
    // The Bank's board, a dark plate under the towers with rounded corners, as table points.
    bank: { x: number; y: number; width: number; depth: number; outline: Point[] }
    // The space the table needs on screen.
    frame: { x: number; y: number; width: number; height: number }
}

const SHIP_GAP = 12
const STAR_GAP = 12
const SYSTEM_GAP = 56
const ROW_GAP = 64
const RING_MARGIN = 14
const SHIPS_PER_LINE = 3
// A nested pyramid's walls are this thick, so it rests a little higher than its outside suggests.
const WALL = 3
// A pyramid nested on one of its own size rests this share of its height above it.
const SAME_SIZE_NEST = 0.3
const LABEL_ROOM = 26
const LABEL_HALF_WIDTH = 72

// A pyramid set over a smaller one slides down until its inside meets the one below.
export function nestLift(below: PyramidSize, above: PyramidSize): number {
    const height = PYRAMID_HEIGHT[below]
    const meets = height * (1 - (PYRAMID_BASE[above] - 2 * WALL) / PYRAMID_BASE[below])
    return Math.max(meets, PYRAMID_HEIGHT[above] * SAME_SIZE_NEST)
}

// Small turns that keep a star from facing the viewer squarely, the same for a piece every time.
function yawOf(piece: number): number {
    return (((piece * 37) % 11) / 11 - 0.5) * 0.5 + 0.35
}

// The bigger star at the bottom, the smaller nested on it, as players stack a binary star.
function starsOf(system: StarSystem): StarPlacement[] {
    const stars = system.stars.toSorted((a, b) => pieceSize(b) - pieceSize(a) || a - b)
    const [bottom, top] = stars
    if (bottom === undefined) return []
    const placements: StarPlacement[] = [{ piece: bottom, x: 0, y: 0, lift: 0, yaw: yawOf(bottom) }]
    if (top !== undefined) {
        placements.push({
            piece: top,
            x: 0,
            y: 0,
            lift: nestLift(pieceSize(bottom), pieceSize(top)),
            yaw: yawOf(top)
        })
    }
    return placements
}

// The map runs from the viewer's homeworld in one near corner to the opponent's in the far
// corner opposite: `along` points that way, `right` to its right on the table.
type Axes = { along: Point; right: Point }

// How far the map's line leans from straight away from the viewer, on the table: steeply for a
// tall screen, or 45° further over for a wide one.
const TALL_LEAN = Math.PI / 6
const WIDE_LEAN = TALL_LEAN + Math.PI / 4

function axesFor(wide: boolean): Axes {
    const lean = wide ? WIDE_LEAN : TALL_LEAN
    const along = { x: Math.sin(lean), y: Math.cos(lean) }
    return { along, right: { x: along.y, y: -along.x } }
}

function toTable(axes: Axes, u: number, v: number): Point {
    return {
        x: u * axes.along.x + v * axes.right.x,
        y: u * axes.along.y + v * axes.right.y
    }
}

// Turned from straight away from the viewer towards +x, as a ship's heading is.
function headingOf(direction: Point): number {
    return Math.atan2(direction.x, direction.y)
}

type LocalShip = Ship & { u: number; v: number; ahead: boolean }

// A side's ships in lines of three running outward from the star, larger ones first. Each points
// along the map, ahead for the viewer, back for the opponent; in system terms u runs along the
// map and v across it.
function shipsOnSide(
    ships: Ship[],
    side: 1 | -1,
    start: number
): { ships: LocalShip[]; reach: number; halfDepth: number } {
    const sorted = ships.toSorted(
        (a, b) =>
            pieceSize(b.piece) - pieceSize(a.piece) ||
            PYRAMID_COLORS.indexOf(pieceColor(a.piece)) -
                PYRAMID_COLORS.indexOf(pieceColor(b.piece)) ||
            a.piece - b.piece
    )
    const lines: Ship[][] = []
    sorted.forEach((ship, index) => {
        const line = Math.floor(index / SHIPS_PER_LINE)
        ;(lines[line] ??= []).push(ship)
    })
    const lineDepth = (line: Ship[]) =>
        Math.max(...line.map((ship) => shipFootprint(pieceSize(ship.piece), 0).deep))
    const depth =
        lines.reduce((sum, line) => sum + lineDepth(line), 0) + SHIP_GAP * (lines.length - 1)
    let reach = 0
    let u = depth / 2
    const placed: LocalShip[] = []
    for (const line of lines) {
        const length = lineDepth(line)
        let v = start
        for (const ship of line) {
            const { across } = shipFootprint(pieceSize(ship.piece), 0)
            placed.push({
                ...ship,
                u: u - length / 2,
                v: side * (v + across / 2),
                ahead: side === 1
            })
            v += across + SHIP_GAP
        }
        reach = Math.max(reach, v - SHIP_GAP)
        u -= length + SHIP_GAP
    }
    return { ships: placed, reach, halfDepth: depth / 2 }
}

type LocalSystem = {
    system: StarSystem
    stars: StarPlacement[]
    ships: LocalShip[]
    // Across the map, from the star: how far it reaches to the left (negative) and right.
    left: number
    right: number
    halfDepth: number
}

// Ships keep to their owner's right of the star, as cars keep to their side of the road: the
// viewer's on the right of the line their ships travel, the opponent's on the other side.
function arrangeSystem(system: StarSystem, nearId: string | undefined): LocalSystem {
    const stars = starsOf(system)
    const starHalf = Math.max(0, ...stars.map((star) => PYRAMID_BASE[pieceSize(star.piece)])) / 2
    const near = shipsOnSide(
        system.ships.filter((ship) => ship.ownerId === nearId),
        1,
        starHalf + STAR_GAP
    )
    const far = shipsOnSide(
        system.ships.filter((ship) => ship.ownerId !== nearId),
        -1,
        starHalf + STAR_GAP
    )
    return {
        system,
        stars,
        ships: [...near.ships, ...far.ships],
        left: -Math.max(starHalf, far.reach),
        right: Math.max(starHalf, near.reach),
        halfDepth: Math.max(starHalf, near.halfDepth, far.halfDepth)
    }
}

// A capsule round the system, lying across the map.
function ringOf(axes: Axes, centre: Point, local: LocalSystem): Point[] {
    const radius = local.halfDepth + RING_MARGIN
    const from = local.left - RING_MARGIN + radius
    const to = local.right + RING_MARGIN - radius
    const points: Point[] = []
    const STEPS = 14
    // Round the far end across the map, then back round the near end.
    const cap = (v: number, start: number) => {
        for (let step = 0; step <= STEPS; step++) {
            const turn = start + (step / STEPS) * Math.PI
            const point = toTable(axes, Math.cos(turn) * radius, v + Math.sin(turn) * radius)
            points.push({ x: centre.x + point.x, y: centre.y + point.y })
        }
    }
    cap(Math.max(from, to), 0)
    cap(Math.min(from, to), Math.PI)
    return points
}

type Seats = { nearId?: string; farId?: string }

// Rows from the near homeworld to the far one. Basic stars go by size: a size joined to the near
// homeworld only nearest it, one joined to neither (or both) in the middle, one joined to the far
// homeworld only nearest that; so each row joins the rows either side but never itself.
function rowKey(system: StarSystem, homes: { near?: StarSystem; far?: StarSystem }): number {
    if (system.homeworldOf !== undefined && system === homes.near) return -10
    if (system.homeworldOf !== undefined && system === homes.far) return 10
    const size = pieceSize(system.stars[0] ?? 0)
    const joins = (home?: StarSystem) =>
        home !== undefined && !home.stars.some((star) => pieceSize(star) === size)
    const score = Number(joins(homes.far)) - Number(joins(homes.near))
    return score * 3 + PYRAMID_SIZES.indexOf(size) - 1
}

// Within a row, the opponent's systems to the left of the map's line, shared ones on it, the
// viewer's to the right.
function sideKey(system: StarSystem, seats: Seats): number {
    const owners = new Set(system.ships.map((ship) => ship.ownerId))
    const near = seats.nearId !== undefined && owners.has(seats.nearId)
    const far = [...owners].some((owner) => owner !== seats.nearId)
    if (system.homeworldOf !== undefined) return 0
    return near && !far ? 1 : far && !near ? -1 : 0
}

// How far the Bank's towers turn, so their faces catch the light.
export const BANK_YAW = 0.3
// Between the Bank's towers, and from the outer towers to the board's edge.
const BANK_SPACING = 4
const BANK_MARGIN = 10
const BANK_STEP = 20

type Box = { left: number; right: number; near: number; far: number }

function boxOf(points: readonly Point[]): Box {
    return {
        left: Math.min(...points.map((point) => point.x)),
        right: Math.max(...points.map((point) => point.x)),
        near: Math.min(...points.map((point) => point.y)),
        far: Math.max(...points.map((point) => point.y))
    }
}

// The screens each lean of the map is laid out for, as width over height: a phone's game column,
// and a desktop's.
const BANK_CORNER = 34
const BANK_GAP = 10
const TALL_SCREEN = 0.9
const WIDE_SCREEN = 1.7
const BANK_TRIES = 24

// The Bank's board as in the box: a column per colour, Large at the back, Small at the front,
// each size stacked in a tower, each row only as deep as its size. It stays in the board's top
// left corner, with nothing further left or higher: in the map's far corner on the viewer's
// homeworld's side, and where the map leaves no room there, moved left or further away,
// wherever the board then fits the screen it is laid out for the largest.
function bankLayout(
    systems: readonly SystemPlacement[],
    view: BoardView,
    wide: boolean,
    content: readonly Point[],
    shapes: readonly Point[][]
) {
    const sizes = [PyramidSize.Small, PyramidSize.Medium, PyramidSize.Large]
    // A turned tower's base reaches further than its side.
    const reach = (size: PyramidSize) =>
        PYRAMID_BASE[size] * (Math.cos(BANK_YAW) + Math.sin(BANK_YAW)) + BANK_SPACING
    const column = reach(PyramidSize.Large)
    const rowDepth = sizes.map(reach)
    const rowAt = rowDepth.map(
        (depth, row) => rowDepth.slice(0, row).reduce((sum, before) => sum + before, 0) + depth / 2
    )
    const width = PYRAMID_COLORS.length * column + BANK_MARGIN * 2
    const depth = rowDepth.reduce((sum, row) => sum + row, 0) + BANK_MARGIN * 2
    const map = boxOf(systems.flatMap((system) => system.outline))
    const towersAt = (left: number, near: number): TowerPlacement[] =>
        PYRAMID_COLORS.flatMap((color, index) =>
            sizes.map((size, row) => ({
                color,
                size,
                x: left + BANK_MARGIN + (index + 0.5) * column,
                y: near + BANK_MARGIN + rowAt[row]
            }))
        )
    // The plate, and every tower standing full, as seen on screen; the table's projection is
    // linear, so the shape is found once and moved.
    const origin = onTable(view, 0, 0)
    const shapeHere = hull([
        ...roundedRect(0, 0, width, depth, BANK_CORNER).map((point) =>
            onTable(view, point.x, point.y)
        ),
        ...towersAt(0, 0).flatMap((tower) => {
            const at = onTable(view, tower.x, tower.y)
            const half = PYRAMID_BASE[tower.size] / 2
            return [
                { x: at.x, y: at.y - towerHeight(tower.size) * view.rise },
                { x: at.x - half, y: at.y },
                { x: at.x + half, y: at.y }
            ]
        })
    ])
    const boxHere = boxOf(shapeHere)
    const shapeOf = (left: number, near: number): Point[] => {
        const at = onTable(view, left, near)
        return shapeHere.map((point) => ({
            x: point.x + at.x - origin.x,
            y: point.y + at.y - origin.y
        }))
    }
    const fitOf = fitter(wide)
    const start = { left: map.left, near: systems.length > 0 ? map.far - depth : 0 }
    const around = boxOf(content)
    const boxes = shapes.map(boxOf)
    let best = { ...start, fit: -1 }
    for (let across = 0; across < BANK_TRIES; across++) {
        for (let away = 0; away < BANK_TRIES; away++) {
            const left = start.left - across * BANK_STEP
            const near = start.near + away * BANK_STEP
            const at = onTable(view, left, near)
            const corner = {
                left: boxHere.left + at.x - origin.x,
                right: boxHere.right + at.x - origin.x,
                near: boxHere.near + at.y - origin.y,
                far: boxHere.far + at.y - origin.y
            }
            if (corner.left > around.left || corner.near > around.near) continue
            const fit = fitOf([
                { x: corner.left, y: corner.near },
                { x: Math.max(corner.right, around.right), y: Math.max(corner.far, around.far) }
            ])
            if (fit <= best.fit + 1e-9) continue
            const shape = shapeOf(left, near)
            const blocked = shapes.some(
                (other, index) =>
                    boxesNear(corner, boxes[index], BANK_GAP) && convexNear(shape, other, BANK_GAP)
            )
            if (!blocked) best = { left, near, fit }
        }
    }
    return {
        towers: towersAt(best.left, best.near),
        bank: {
            x: best.left,
            y: best.near,
            width,
            depth,
            outline: roundedRect(best.left, best.near, width, depth, BANK_CORNER)
        },
        points: shapeOf(best.left, best.near)
    }
}

// Whether two boxes come within `gap` of each other.
function boxesNear(a: Box, b: Box | undefined, gap: number): boolean {
    if (b === undefined) return false
    return !(
        a.right + gap < b.left ||
        b.right + gap < a.left ||
        a.far + gap < b.near ||
        b.far + gap < a.near
    )
}

// How large a board holding these screen points is drawn on the screen its map is laid out for.
function fitter(wide: boolean) {
    const screen = wide ? WIDE_SCREEN : TALL_SCREEN
    return (points: readonly Point[]) => {
        const extent = boxOf(points)
        return Math.min(screen / (extent.right - extent.left), 1 / (extent.far - extent.near))
    }
}

function roundedRect(left: number, near: number, width: number, depth: number, radius: number) {
    const corners = [
        { x: left + width - radius, y: near + radius, start: -Math.PI / 2 },
        { x: left + width - radius, y: near + depth - radius, start: 0 },
        { x: left + radius, y: near + depth - radius, start: Math.PI / 2 },
        { x: left + radius, y: near + radius, start: Math.PI }
    ]
    const STEPS = 6
    return corners.flatMap((corner) =>
        Array.from({ length: STEPS + 1 }, (_, step) => {
            const turn = corner.start + (step / STEPS) * (Math.PI / 2)
            return { x: corner.x + Math.cos(turn) * radius, y: corner.y + Math.sin(turn) * radius }
        })
    )
}

// A tower of three of a size, nested.
function towerHeight(size: PyramidSize): number {
    return PYRAMID_HEIGHT[size] + 2 * nestLift(size, size)
}

export function tableLayout(
    systems: readonly StarSystem[],
    seats: Seats,
    view: BoardView,
    wide: boolean
): TableLayout {
    const axes = axesFor(wide)
    const homes = {
        near: systems.find((system) => system.homeworldOf === seats.nearId),
        far: systems.find(
            (system) => system.homeworldOf !== undefined && system.homeworldOf !== seats.nearId
        )
    }
    const rows = new Map<number, StarSystem[]>()
    for (const system of systems) {
        const key = rowKey(system, homes)
        rows.set(key, [...(rows.get(key) ?? []), system])
    }
    const keys = [...rows.keys()].toSorted((a, b) => a - b)
    const aheadHeading = headingOf(axes.along)

    const placed: SystemPlacement[] = []
    let u = 0
    for (const key of keys) {
        const row = (rows.get(key) ?? [])
            .toSorted((a, b) => sideKey(a, seats) - sideKey(b, seats) || a.id - b.id)
            .map((system) => arrangeSystem(system, seats.nearId))
        const halfDepth = Math.max(...row.map((local) => local.halfDepth)) + RING_MARGIN
        const width =
            row.reduce((sum, local) => sum + local.right - local.left + RING_MARGIN * 2, 0) +
            SYSTEM_GAP * (row.length - 1)
        u += halfDepth
        let v = -width / 2
        for (const local of row) {
            const starV = v + RING_MARGIN - local.left
            const centre = toTable(axes, u, starV)
            placed.push({
                id: local.system.id,
                x: centre.x,
                y: centre.y,
                stars: local.stars.map((star) => ({ ...star, x: centre.x, y: centre.y })),
                ships: local.ships.map(({ u: shipU, v: shipV, ahead, ...ship }) => {
                    const offset = toTable(axes, shipU, shipV)
                    return {
                        ...ship,
                        x: centre.x + offset.x,
                        y: centre.y + offset.y,
                        heading: ahead ? aheadHeading : aheadHeading + Math.PI
                    }
                }),
                outline: ringOf(axes, centre, local),
                ...(local.system.homeworldOf !== undefined
                    ? { homeworldOf: local.system.homeworldOf }
                    : {})
            })
            v += local.right - local.left + RING_MARGIN * 2 + SYSTEM_GAP
        }
        u += halfDepth + ROW_GAP
    }

    const screen = (point: Point) => onTable(view, point.x, point.y)
    // Each piece's top as it stands, so the board ends where the pieces do.
    const systemOfTop = placed.flatMap((system) =>
        [...system.stars, ...system.ships].map(() => system.id)
    )
    const tops = placed.flatMap((system) => [
        ...system.stars.map((star) => {
            const at = screen(star)
            const size = pieceSize(star.piece)
            return { x: at.x, y: at.y - (star.lift + PYRAMID_HEIGHT[size]) * view.rise }
        }),
        ...system.ships.map((ship) => {
            const at = screen(ship)
            return { x: at.x, y: at.y - PYRAMID_BASE[pieceSize(ship.piece)] * view.rise }
        })
    ])
    const ground = placed.flatMap((system) => system.outline.map(screen))
    // Each system's name, under its ring's nearest point, about this wide either side.
    const labelShapes = placed.map((system) => {
        const nearest = system.outline
            .map(screen)
            .reduce((best, point) => (point.y > best.y ? point : best))
        return [
            { x: nearest.x - LABEL_HALF_WIDTH, y: nearest.y },
            { x: nearest.x + LABEL_HALF_WIDTH, y: nearest.y },
            { x: nearest.x + LABEL_HALF_WIDTH, y: nearest.y + LABEL_ROOM },
            { x: nearest.x - LABEL_HALF_WIDTH, y: nearest.y + LABEL_ROOM }
        ]
    })
    const systemShapes = placed.map((system) =>
        hull([
            ...system.outline.map(screen),
            ...tops.filter((_, index) => systemOfTop[index] === system.id)
        ])
    )
    const mapPoints = [...ground, ...tops, ...labelShapes.flat()]
    const content = mapPoints
    // What the Bank must keep clear of: each system with its pieces and its name.
    const shapes = [...systemShapes, ...labelShapes]
    const { towers, bank, points: bankPoints } = bankLayout(placed, view, wide, content, shapes)
    const all = [...content, ...bankPoints]
    const margin = 14
    const minX = Math.min(...all.map((point) => point.x)) - margin
    const maxX = Math.max(...all.map((point) => point.x)) + margin
    const minY = Math.min(...all.map((point) => point.y)) - margin
    const maxY = Math.max(...all.map((point) => point.y)) + margin
    return {
        systems: placed,
        towers,
        bank,
        frame: { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
    }
}
