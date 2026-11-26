import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { assert, assertExists, Hydratable } from '@tabletop/common'
import {
    ALL_PIECES,
    PIECE_COUNT,
    PieceId,
    type PieceKind,
    pieceColor,
    pieceSize,
    piecesOfKind,
    PYRAMID_COLORS,
    PyramidColor,
    PyramidSize
} from './pieces.js'

export type Ship = Type.Static<typeof Ship>
export const Ship = Type.Object({
    piece: PieceId,
    ownerId: Type.String()
})

// A basic star's system takes its star's piece id; homeworlds take the ids past the pieces, one
// per seat, so no two systems on the map share an id.
export const HOMEWORLD_SYSTEM_IDS = [PIECE_COUNT, PIECE_COUNT + 1] as const

export type SystemId = Type.Static<typeof SystemId>
export const SystemId = Type.Integer({ minimum: 0, maximum: PIECE_COUNT + 1 })

export type StarSystem = Type.Static<typeof StarSystem>
export const StarSystem = Type.Object({
    id: SystemId,
    stars: Type.Array(PieceId, { minItems: 1, maxItems: 2 }),
    homeworldOf: Type.Optional(Type.String()),
    ships: Type.Array(Ship)
})

export type StarMap = Type.Static<typeof StarMap>
export const StarMap = Type.Object({
    systems: Type.Array(StarSystem)
})

export const StarMapValidator = Compile(StarMap)

// Four pieces of one colour in one system, star included, make it overpopulated.
export const OVERPOPULATION = 4

export type Overpopulation = { systemId: number; color: PyramidColor }

export type Destroyed = Type.Static<typeof Destroyed>
export const Destroyed = Type.Object({
    stars: Type.Array(PieceId),
    ships: Type.Array(Ship),
    // A basic star left with no ships, or a homeworld with no stars left, leaves the map.
    systemRemoved: Type.Boolean()
})

export class HydratedStarMap extends Hydratable<typeof StarMap> implements StarMap {
    declare systems: StarSystem[]

    constructor(data: StarMap) {
        super(data, StarMapValidator)
    }

    system(systemId: number): StarSystem {
        const system = this.findSystem(systemId)
        assertExists(system, `No system ${systemId}`)
        return system
    }

    findSystem(systemId: number): StarSystem | undefined {
        return this.systems.find((system) => system.id === systemId)
    }

    homeworldOf(playerId: string): StarSystem | undefined {
        return this.systems.find((system) => system.homeworldOf === playerId)
    }

    systemOfShip(piece: number): StarSystem | undefined {
        return this.systems.find((system) => system.ships.some((ship) => ship.piece === piece))
    }

    ship(piece: number): Ship | undefined {
        return this.systemOfShip(piece)?.ships.find((ship) => ship.piece === piece)
    }

    piecesInPlay(): Set<number> {
        const pieces = new Set<number>()
        for (const system of this.systems) {
            for (const star of system.stars) pieces.add(star)
            for (const ship of system.ships) pieces.add(ship.piece)
        }
        return pieces
    }

    bank(): number[] {
        const inPlay = this.piecesInPlay()
        return ALL_PIECES.filter((piece) => !inPlay.has(piece))
    }

    // The first free piece of a kind, so the same choice always takes the same piece.
    bankPiece(kind: PieceKind): number | undefined {
        const inPlay = this.piecesInPlay()
        return piecesOfKind(kind).find((piece) => !inPlay.has(piece))
    }

    // Green builds the smallest of the colour the Bank has.
    smallestInBank(color: PyramidColor): number | undefined {
        return this.bank()
            .filter((piece) => pieceColor(piece) === color)
            .sort((a, b) => pieceSize(a) - pieceSize(b) || a - b)[0]
    }

    // Systems are connected when no star of one is the size of a star of the other.
    connected(a: StarSystem, b: StarSystem): boolean {
        return a.id !== b.id && !a.stars.some((star) => starSizes(b).has(pieceSize(star)))
    }

    connectedSystems(systemId: number): StarSystem[] {
        const from = this.system(systemId)
        return this.systems.filter((other) => this.connected(from, other))
    }

    // A star may be discovered from a system when its size is none of the system's star sizes.
    canDiscoverFrom(systemId: number, size: PyramidSize): boolean {
        return !starSizes(this.system(systemId)).has(size)
    }

    ownShips(system: StarSystem, playerId: string): Ship[] {
        return system.ships.filter((ship) => ship.ownerId === playerId)
    }

    hasShipIn(system: StarSystem, playerId: string): boolean {
        return system.ships.some((ship) => ship.ownerId === playerId)
    }

    largestOwnSize(system: StarSystem, playerId: string): number {
        return Math.max(0, ...this.ownShips(system, playerId).map((ship) => pieceSize(ship.piece)))
    }

    // A player has a colour's power in a system from its star or from a ship of their own there.
    hasAccess(system: StarSystem, playerId: string, color: PyramidColor): boolean {
        return (
            system.stars.some((star) => pieceColor(star) === color) ||
            this.ownShips(system, playerId).some((ship) => pieceColor(ship.piece) === color)
        )
    }

    countOfColor(system: StarSystem, color: PyramidColor): number {
        return [...system.stars, ...system.ships.map((ship) => ship.piece)].filter(
            (piece) => pieceColor(piece) === color
        ).length
    }

    overpopulations(): Overpopulation[] {
        return this.systems.flatMap((system) =>
            PYRAMID_COLORS.filter(
                (color) => this.countOfColor(system, color) >= OVERPOPULATION
            ).map((color) => ({ systemId: system.id, color }))
        )
    }

    addHomeworld(systemId: number, playerId: string, stars: number[], ship: number) {
        this.assertInBank([...stars, ship])
        this.systems.push({
            id: systemId,
            stars,
            homeworldOf: playerId,
            ships: [{ piece: ship, ownerId: playerId }]
        })
    }

    addShip(systemId: number, ship: Ship) {
        this.assertInBank([ship.piece])
        this.system(systemId).ships.push(ship)
    }

    // Takes a ship off the map; a basic star left with no ships goes back to the Bank.
    removeShip(piece: number): { system: StarSystem; abandoned: boolean } {
        const system = this.systemOfShip(piece)
        assertExists(system, `Piece ${piece} is not a ship`)
        system.ships = system.ships.filter((ship) => ship.piece !== piece)
        return { system, abandoned: this.removeIfAbandoned(system) }
    }

    discover(star: number): StarSystem {
        this.assertInBank([star])
        const system: StarSystem = { id: star, stars: [star], ships: [] }
        this.systems.push(system)
        return system
    }

    replaceShipPiece(piece: number, replacement: number) {
        this.assertInBank([replacement])
        const ship = this.ship(piece)
        assertExists(ship, `Piece ${piece} is not a ship`)
        ship.piece = replacement
    }

    // Every piece of the colour goes back to the Bank. When that takes the last star, every ship
    // goes with it; half of a binary star leaves the homeworld a single star.
    catastrophe(systemId: number, color: PyramidColor): Destroyed {
        const system = this.system(systemId)
        const stars = system.stars.filter((star) => pieceColor(star) === color)
        system.stars = system.stars.filter((star) => pieceColor(star) !== color)
        const starless = system.stars.length === 0
        const ships = system.ships.filter((ship) => starless || pieceColor(ship.piece) === color)
        system.ships = system.ships.filter((ship) => !ships.includes(ship))
        const systemRemoved = starless || this.removeIfAbandoned(system)
        if (starless) this.systems = this.systems.filter((other) => other !== system)
        return { stars, ships, systemRemoved }
    }

    private removeIfAbandoned(system: StarSystem): boolean {
        if (system.homeworldOf !== undefined || system.ships.length > 0) return false
        this.systems = this.systems.filter((other) => other !== system)
        return true
    }

    private assertInBank(pieces: number[]) {
        const inPlay = this.piecesInPlay()
        for (const piece of pieces) {
            assert(!inPlay.has(piece), `Piece ${piece} is not in the Bank`)
        }
    }
}

export function starSizes(system: StarSystem): Set<PyramidSize> {
    return new Set(system.stars.map(pieceSize))
}
