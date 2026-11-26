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
import { PYRAMID_BASE, PYRAMID_HEIGHT, shipFootprint } from './pyramid.js'
import type { BoardView } from './view.js'

// Where everything stands on the table, in table units: x right, y away from the near player.
export type StarPlacement = { piece: number; x: number; y: number; lift: number; yaw: number }
export type ShipPlacement = Ship & { x: number; y: number; heading: number }

export type SystemPlacement = {
    id: number
    x: number
    y: number
    // Half the system's width and depth, from its middle.
    halfWidth: number
    halfDepth: number
    stars: StarPlacement[]
    ships: ShipPlacement[]
    homeworldOf?: string
}

export type TowerPlacement = { color: PyramidColor; size: PyramidSize; x: number; y: number }

export type TableLayout = {
    systems: SystemPlacement[]
    towers: TowerPlacement[]
    // The Bank's board, a dark plate under the towers.
    bank: { x: number; y: number; width: number; depth: number }
    // Where the turn token rests on each seat's side, near first.
    tokenSpots: { near: { x: number; y: number }; far: { x: number; y: number } }
    // The space the table needs on screen.
    frame: { x: number; y: number; width: number; height: number }
}

const SHIP_GAP = 7
const STAR_GAP = 14
const SYSTEM_GAP = 30
const ROW_GAP = 36
const SHIPS_PER_ROW = 3
// A pyramid nested on one of its own size rests this share of its height above it.
const SAME_SIZE_NEST = 0.3
const TOKEN_RADIUS = 50
const MIN_WIDTH = 560

export const TURN_TOKEN_RADIUS = TOKEN_RADIUS

// A pyramid set over a smaller one slides down until its walls meet the one below.
export function nestLift(below: PyramidSize, above: PyramidSize): number {
    const height = PYRAMID_HEIGHT[below]
    const meets = height * (1 - PYRAMID_BASE[above] / PYRAMID_BASE[below])
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

// A side's ships in rows of three running outward from the star, larger ones first.
function shipsOnSide(
    ships: Ship[],
    side: 1 | -1,
    startX: number,
    heading: number
): { placements: ShipPlacement[]; width: number; depth: number } {
    const sorted = ships.toSorted(
        (a, b) =>
            pieceSize(b.piece) - pieceSize(a.piece) ||
            PYRAMID_COLORS.indexOf(pieceColor(a.piece)) -
                PYRAMID_COLORS.indexOf(pieceColor(b.piece)) ||
            a.piece - b.piece
    )
    const rows: Ship[][] = []
    sorted.forEach((ship, index) => {
        const row = Math.floor(index / SHIPS_PER_ROW)
        ;(rows[row] ??= []).push(ship)
    })
    const rowDepth = (row: Ship[]) =>
        Math.max(...row.map((ship) => shipFootprint(pieceSize(ship.piece), heading).deep))
    const depth = rows.reduce((sum, row) => sum + rowDepth(row), 0) + SHIP_GAP * (rows.length - 1)
    let width = 0
    let y = depth / 2
    const placements: ShipPlacement[] = []
    // The first row farthest away, so the bigger ships stand behind.
    for (const row of rows) {
        const reach = rowDepth(row)
        let x = startX
        for (const ship of row) {
            const { across } = shipFootprint(pieceSize(ship.piece), heading)
            placements.push({ ...ship, x: side * (x + across / 2), y: y - reach / 2, heading })
            x += across + SHIP_GAP
        }
        width = Math.max(width, x - SHIP_GAP - startX)
        y -= reach + SHIP_GAP
    }
    return { placements, width, depth }
}

// Ships point away from their owner. Seen from behind, a ship pointing straight away shows only
// its open base, so each lies turned out to its owner's right: the near player's to the right of
// the star pointing away and right, the far player's to the left pointing towards the viewer and
// left, as cars keep to their own side of the road.
export const SHIP_TURN = 1
function placeSystem(system: StarSystem, nearId: string | undefined): SystemPlacement {
    const stars = starsOf(system)
    const starHalf = Math.max(0, ...stars.map((star) => PYRAMID_BASE[pieceSize(star.piece)])) / 2
    const near = system.ships.filter((ship) => ship.ownerId === nearId)
    const far = system.ships.filter((ship) => ship.ownerId !== nearId)
    const right = shipsOnSide(near, 1, starHalf + STAR_GAP, SHIP_TURN)
    const left = shipsOnSide(far, -1, starHalf + STAR_GAP, Math.PI + SHIP_TURN)
    const reach = (side: { width: number }) => (side.width > 0 ? STAR_GAP + side.width : 0)
    const halfWidth = starHalf + Math.max(reach(right), reach(left), 34)
    const halfDepth = Math.max(starHalf, right.depth / 2, left.depth / 2)
    return {
        id: system.id,
        x: 0,
        y: 0,
        halfWidth,
        halfDepth,
        stars,
        ships: [...right.placements, ...left.placements],
        ...(system.homeworldOf !== undefined ? { homeworldOf: system.homeworldOf } : {})
    }
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

// Within a row, the far player's systems on the left, shared ones in the middle, the near
// player's on the right.
function sideKey(system: StarSystem, seats: Seats): number {
    const owners = new Set(system.ships.map((ship) => ship.ownerId))
    const near = seats.nearId !== undefined && owners.has(seats.nearId)
    const far = [...owners].some((owner) => owner !== seats.nearId)
    if (system.homeworldOf !== undefined) return 0
    return near && !far ? 1 : far && !near ? -1 : 0
}

const BANK_CELL = 66
const BANK_MARGIN = 14

// The Bank's board as in the box: a column per colour, Large at the back, Small at the front,
// each size stacked in a tower.
function bankLayout(centreX: number, frontY: number) {
    const sizes = [PyramidSize.Small, PyramidSize.Medium, PyramidSize.Large]
    const width = PYRAMID_COLORS.length * BANK_CELL
    const depth = sizes.length * BANK_CELL
    const towers: TowerPlacement[] = PYRAMID_COLORS.flatMap((color, column) =>
        sizes.map((size, row) => ({
            color,
            size,
            x: centreX - width / 2 + (column + 0.5) * BANK_CELL,
            y: frontY + BANK_MARGIN + (row + 0.5) * BANK_CELL
        }))
    )
    return {
        towers,
        bank: {
            x: centreX - width / 2 - BANK_MARGIN,
            y: frontY,
            width: width + BANK_MARGIN * 2,
            depth: depth + BANK_MARGIN * 2
        }
    }
}

// The tallest thing that can stand in a row, for keeping rows clear of one another on screen.
const TALLEST = PYRAMID_HEIGHT[PyramidSize.Large] + nestLift(PyramidSize.Large, PyramidSize.Large)

export function tableLayout(
    systems: readonly StarSystem[],
    seats: Seats,
    view: BoardView
): TableLayout {
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

    // The Bank lies along the near edge; the star map rises behind it.
    const bankFront = 0
    const { towers, bank } = bankLayout(0, bankFront)
    let y = bank.y + bank.depth + ROW_GAP
    const placed: SystemPlacement[] = []
    let widest = Math.max(MIN_WIDTH, bank.width)
    // The far rows need room for pieces standing tall in the rows in front on screen.
    const rowRise = (TALLEST * view.rise) / view.tilt
    for (const key of keys) {
        const row = (rows.get(key) ?? []).toSorted(
            (a, b) => sideKey(a, seats) - sideKey(b, seats) || a.id - b.id
        )
        const placements = row.map((system) => placeSystem(system, seats.nearId))
        const depth = Math.max(...placements.map((placement) => placement.halfDepth)) * 2
        const width =
            placements.reduce((sum, placement) => sum + placement.halfWidth * 2, 0) +
            SYSTEM_GAP * (placements.length - 1)
        widest = Math.max(widest, width)
        let x = -width / 2
        for (const placement of placements) {
            const centre = { x: x + placement.halfWidth, y: y + depth / 2 }
            placed.push({
                ...placement,
                x: centre.x,
                y: centre.y,
                stars: placement.stars.map((star) => ({ ...star, x: centre.x, y: centre.y })),
                ships: placement.ships.map((ship) => ({
                    ...ship,
                    x: centre.x + ship.x,
                    y: centre.y + ship.y
                }))
            })
            x += placement.halfWidth * 2 + SYSTEM_GAP
        }
        y += depth + ROW_GAP + rowRise * 0.35
    }
    const farY = y
    const tokenX = -widest / 2 - TOKEN_RADIUS - 24
    const nearHome = placed.find((system) => system.homeworldOf === seats.nearId)
    const farHome = placed.find(
        (system) => system.homeworldOf !== undefined && system.homeworldOf !== seats.nearId
    )
    const tokenSpots = {
        near: { x: tokenX, y: nearHome?.y ?? bank.y + bank.depth + ROW_GAP + TOKEN_RADIUS },
        far: { x: tokenX, y: farHome?.y ?? farY }
    }
    const left = tokenX - TOKEN_RADIUS - 16
    const right = widest / 2 + 16
    const top = -(farY * view.tilt) - TALLEST * view.rise - 16
    const bottom = -(bank.y * view.tilt) + 16
    return {
        systems: placed,
        towers,
        bank,
        tokenSpots,
        frame: { x: left, y: top, width: right - left, height: bottom - top }
    }
}
