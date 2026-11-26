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
    // The Bank's board, a dark plate under the towers.
    bank: { x: number; y: number; width: number; depth: number }
    // Where the turn token rests behind each homeworld, the viewer's first.
    tokenSpots: { near: Point; far: Point }
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
const TOKEN_RADIUS = 50
const TOKEN_GAP = 22
const LABEL_ROOM = 26
const LABEL_HALF_WIDTH = 72
const CONTROLS_ROOM = 40

export const TURN_TOKEN_RADIUS = TOKEN_RADIUS

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

// The tallest thing that can stand on the map, for the room above the far systems.
const TALLEST = PYRAMID_HEIGHT[PyramidSize.Large] + nestLift(PyramidSize.Large, PyramidSize.Large)

const BANK_CELL = 66
const BANK_MARGIN = 14
const BANK_STEP = 20

type Box = { left: number; right: number; near: number; far: number }

function overlaps(a: Box, b: Box): boolean {
    return a.left < b.right && b.left < a.right && a.near < b.far && b.near < a.far
}

function boxOf(points: readonly Point[]): Box {
    return {
        left: Math.min(...points.map((point) => point.x)),
        right: Math.max(...points.map((point) => point.x)),
        near: Math.min(...points.map((point) => point.y)),
        far: Math.max(...points.map((point) => point.y))
    }
}

// The Bank's board as in the box: a column per colour, Large at the back, Small at the front,
// each size stacked in a tower.
function bankLayout(systems: readonly SystemPlacement[], view: BoardView) {
    const sizes = [PyramidSize.Small, PyramidSize.Medium, PyramidSize.Large]
    const width = PYRAMID_COLORS.length * BANK_CELL + BANK_MARGIN * 2
    const depth = sizes.length * BANK_CELL + BANK_MARGIN * 2
    const map = boxOf(systems.flatMap((system) => system.outline))
    // In the far corner on the viewer's homeworld's side, which the map leaves free, moved further
    // away until neither its towers nor the pieces in front of it stand over the other.
    const left = map.left
    let near = systems.length > 0 ? map.far - depth : 0
    const reach = (height: number) => (height * view.rise) / view.tilt
    const towerReach = reach(TALLEST + PYRAMID_HEIGHT[PyramidSize.Large] * 0.6)
    const clear = (box: Box) =>
        systems.every((system) => {
            const ring = boxOf(system.outline)
            return !overlaps(box, {
                ...ring,
                near: ring.near - LABEL_ROOM,
                far: ring.far + reach(TALLEST)
            })
        })
    while (!clear({ left, right: left + width, near, far: near + depth + towerReach })) {
        near += BANK_STEP
    }
    const towers: TowerPlacement[] = PYRAMID_COLORS.flatMap((color, column) =>
        sizes.map((size, row) => ({
            color,
            size,
            x: left + BANK_MARGIN + (column + 0.5) * BANK_CELL,
            y: near + BANK_MARGIN + (row + 0.5) * BANK_CELL
        }))
    )
    return { towers, bank: { x: left, y: near, width, depth } }
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

    // The token rests beside the homeworld of the player whose turn it is, on the map's right,
    // away from the Bank and clear of the corners where the board's controls are.
    const homeSpot = (home: SystemPlacement | undefined, side: number, fallback: number) => {
        const centre = home ?? toTable(axes, fallback, 0)
        const outward = toTable(axes, 0, side)
        const reach = home
            ? Math.max(
                  ...home.outline.map(
                      (point) => (point.x - home.x) * outward.x + (point.y - home.y) * outward.y
                  )
              )
            : 0
        // Further when that side faces the viewer, past the system's name.
        const pastName = (LABEL_ROOM * Math.max(0, -outward.y * side)) / view.tilt
        const step = toTable(axes, 0, side * (reach + pastName + TOKEN_GAP + TOKEN_RADIUS))
        return { x: centre.x + step.x, y: centre.y + step.y }
    }
    const nearHome = placed.find((system) => system.homeworldOf === seats.nearId)
    const farHome = placed.find(
        (system) => system.homeworldOf !== undefined && system.homeworldOf !== seats.nearId
    )
    const tokenSpots = { near: homeSpot(nearHome, 1, 0), far: homeSpot(farHome, 1, u) }
    const { towers, bank } = bankLayout(placed, view)

    const screen = (point: Point) => onTable(view, point.x, point.y)
    const raised = placed.flatMap((system) =>
        system.outline
            .map(screen)
            .flatMap((point) => [
                point,
                { x: point.x, y: point.y - TALLEST * view.rise },
                { x: point.x, y: point.y + LABEL_ROOM }
            ])
    )
    const bankPoints = [
        screen({ x: bank.x, y: bank.y }),
        screen({ x: bank.x + bank.width, y: bank.y }),
        {
            ...screen({ x: bank.x, y: bank.y + bank.depth }),
            y: screen({ x: bank.x, y: bank.y + bank.depth }).y - TALLEST * 1.6 * view.rise
        },
        screen({ x: bank.x + bank.width, y: bank.y + bank.depth })
    ]
    const tokenPoints = [tokenSpots.near, tokenSpots.far].flatMap((spot) => {
        const centre = screen(spot)
        return [
            { x: centre.x - TOKEN_RADIUS, y: centre.y - TOKEN_RADIUS * view.tilt },
            { x: centre.x + TOKEN_RADIUS, y: centre.y + TOKEN_RADIUS * view.tilt + 6 }
        ]
    })
    // Each system's name, under its ring's nearest point, about this wide either side.
    const labelPoints = placed.flatMap((system) => {
        const nearest = system.outline
            .map(screen)
            .reduce((best, point) => (point.y > best.y ? point : best))
        return [
            { x: nearest.x - LABEL_HALF_WIDTH, y: nearest.y + LABEL_ROOM },
            { x: nearest.x + LABEL_HALF_WIDTH, y: nearest.y + LABEL_ROOM }
        ]
    })
    const all = [...raised, ...bankPoints, ...tokenPoints, ...labelPoints]
    const margin = 14
    const minX = Math.min(...all.map((point) => point.x)) - margin
    const maxX = Math.max(...all.map((point) => point.x)) + margin
    const minY = Math.min(...all.map((point) => point.y)) - margin
    // Room below for the zoom buttons and toggles, which lie over the board's bottom corners.
    const maxY = Math.max(...all.map((point) => point.y)) + margin + CONTROLS_ROOM
    return {
        systems: placed,
        towers,
        bank,
        tokenSpots,
        frame: { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
    }
}
