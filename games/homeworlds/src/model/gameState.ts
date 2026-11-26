import {
    addToChecksum,
    assert,
    assertExists,
    GameResult,
    GameState,
    HydratableGameState,
    HydratedTurnManager,
    PrngState
} from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { HomeworldsPlayerState, HydratedHomeworldsPlayerState } from './playerState.js'
import { MachineState } from '../definition/states.js'
import {
    type Destroyed,
    HOMEWORLD_SYSTEM_IDS,
    HydratedStarMap,
    type Ship,
    StarMap,
    type StarSystem
} from './starMap.js'
import {
    isPieceId,
    type PieceKind,
    pieceColor,
    pieceSize,
    PYRAMID_COLORS,
    PyramidColor,
    PyramidSize
} from './pieces.js'
import { Power, POWER_COLOR, type PowerUse } from './powers.js'

export enum EndReason {
    // A player's homeworld is gone or holds none of their ships at the end of a turn.
    Eliminated = 'Eliminated',
    // Both players were out at the end of the same turn: a draw.
    BothEliminated = 'BothEliminated',
    Repetition = 'Repetition'
}

const REPETITIONS_TO_DRAW = 3

export type SacrificePowers = Type.Static<typeof SacrificePowers>
export const SacrificePowers = Type.Object({
    color: Type.Enum(PyramidColor),
    remaining: Type.Integer({ minimum: 1, maximum: PyramidSize.Large })
})

export type HomeworldsGameState = Type.Static<typeof HomeworldsGameState>
export const HomeworldsGameState = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameState, ['players', 'machineState']),
        Type.Object({
            players: Type.Array(HomeworldsPlayerState, { minItems: 2, maxItems: 2 }),
            machineState: Type.Enum(MachineState),
            starMap: StarMap,
            // The actions a sacrifice still gives this turn.
            sacrifice: Type.Optional(SacrificePowers),
            // The position at the start of each turn, for the draw by repetition.
            positions: Type.Array(Type.Number()),
            endReason: Type.Optional(Type.Enum(EndReason))
        })
    ])
)

export const HomeworldsGameStateValidator = Compile(HomeworldsGameState)

export type PowerResult = {
    piece?: number
    fromSystemId?: number
    fromOwnerId?: string
    abandonedStars?: number[]
}

export class HydratedHomeworldsGameState
    extends HydratableGameState<typeof HomeworldsGameState, HydratedHomeworldsPlayerState>
    implements HomeworldsGameState
{
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedHomeworldsPlayerState[]
    declare turnManager: HydratedTurnManager
    declare machineState: MachineState
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare starMap: HydratedStarMap
    declare sacrifice?: SacrificePowers
    declare positions: number[]
    declare endReason?: EndReason

    constructor(data: HomeworldsGameState) {
        super(data, HomeworldsGameStateValidator)
        this.players = data.players.map((player) => new HydratedHomeworldsPlayerState(player))
        this.starMap = new HydratedStarMap(data.starMap)
    }

    seatOf(playerId: string): number {
        const seat = this.players.findIndex((player) => player.playerId === playerId)
        assert(seat >= 0, `No player ${playerId}`)
        return seat
    }

    homeworldSystemId(playerId: string): number {
        const id = HOMEWORLD_SYSTEM_IDS[this.seatOf(playerId)]
        assertExists(id, `No homeworld for seat of ${playerId}`)
        return id
    }

    opponentOf(playerId: string): string {
        const opponent = this.players.find((player) => player.playerId !== playerId)
        assertExists(opponent, `No opponent for ${playerId}`)
        return opponent.playerId
    }

    // The two stars and the Large ship must all be in the Bank together.
    canCreateHomeworld(playerId: string, stars: PieceKind[], ship: PyramidColor): boolean {
        return (
            this.starMap.homeworldOf(playerId) === undefined &&
            this.homeworldPieces(stars, ship) !== undefined
        )
    }

    createHomeworld(playerId: string, stars: PieceKind[], ship: PyramidColor) {
        const pieces = this.homeworldPieces(stars, ship)
        assertExists(pieces, 'The homeworld is not in the Bank')
        this.starMap.addHomeworld(
            this.homeworldSystemId(playerId),
            playerId,
            pieces.stars,
            pieces.ship
        )
        return pieces
    }

    everyoneHasAHomeworld(): boolean {
        return this.players.every(
            (player) => this.starMap.homeworldOf(player.playerId) !== undefined
        )
    }

    // The system a power is used in.
    powerSystem(use: PowerUse): StarSystem | undefined {
        return use.power === Power.Build
            ? this.starMap.findSystem(use.systemId)
            : this.starMap.systemOfShip(use.ship)
    }

    // Before any action a player may use a colour where they have a ship and its star or one of
    // their ships there has the colour; a sacrifice's colour works wherever they have a ship.
    hasPower(playerId: string, color: PyramidColor, system: StarSystem): boolean {
        if (!this.starMap.hasShipIn(system, playerId)) return false
        if (this.sacrifice !== undefined) return this.sacrifice.color === color
        return (
            this.machineState === MachineState.TakingTurn &&
            this.starMap.hasAccess(system, playerId, color)
        )
    }

    canUse(playerId: string, use: PowerUse): boolean {
        const system = this.powerSystem(use)
        if (system === undefined || !this.hasPower(playerId, POWER_COLOR[use.power], system)) {
            return false
        }
        switch (use.power) {
            case Power.Build:
                return (
                    this.starMap
                        .ownShips(system, playerId)
                        .some((ship) => pieceColor(ship.piece) === use.color) &&
                    this.starMap.smallestInBank(use.color) !== undefined
                )
            case Power.Move: {
                const to = this.starMap.findSystem(use.systemId)
                return (
                    this.ownsShip(playerId, use.ship) &&
                    to !== undefined &&
                    this.starMap.connected(system, to)
                )
            }
            case Power.Discover:
                return (
                    this.ownsShip(playerId, use.ship) &&
                    this.starMap.canDiscoverFrom(system.id, use.star.size) &&
                    this.starMap.bankPiece(use.star) !== undefined
                )
            case Power.Capture: {
                const ship = this.starMap.ship(use.ship)
                return (
                    ship !== undefined &&
                    ship.ownerId !== playerId &&
                    pieceSize(ship.piece) <= this.starMap.largestOwnSize(system, playerId)
                )
            }
            case Power.Trade:
                return (
                    this.ownsShip(playerId, use.ship) &&
                    pieceColor(use.ship) !== use.color &&
                    this.starMap.bankPiece({ color: use.color, size: pieceSize(use.ship) }) !==
                        undefined
                )
        }
    }

    usePower(playerId: string, use: PowerUse): PowerResult {
        assert(this.canUse(playerId, use), `Power ${use.power} is not open to ${playerId}`)
        switch (use.power) {
            case Power.Build: {
                const piece = this.starMap.smallestInBank(use.color)
                assertExists(piece, 'Nothing of the colour to build')
                this.starMap.addShip(use.systemId, { piece, ownerId: playerId })
                return { piece }
            }
            case Power.Move: {
                const { system, abandoned } = this.starMap.removeShip(use.ship)
                this.starMap.system(use.systemId).ships.push({ piece: use.ship, ownerId: playerId })
                return { fromSystemId: system.id, abandonedStars: abandoned ? system.stars : [] }
            }
            case Power.Discover: {
                const star = this.starMap.bankPiece(use.star)
                assertExists(star, 'The star is not in the Bank')
                const { system, abandoned } = this.starMap.removeShip(use.ship)
                const discovered = this.starMap.discover(star)
                discovered.ships.push({ piece: use.ship, ownerId: playerId })
                return {
                    piece: star,
                    fromSystemId: system.id,
                    abandonedStars: abandoned ? system.stars : []
                }
            }
            case Power.Capture: {
                const ship = this.starMap.ship(use.ship)
                assertExists(ship, 'No ship to capture')
                const fromOwnerId = ship.ownerId
                ship.ownerId = playerId
                return { fromOwnerId }
            }
            case Power.Trade: {
                const piece = this.starMap.bankPiece({
                    color: use.color,
                    size: pieceSize(use.ship)
                })
                assertExists(piece, 'Nothing to trade for')
                this.starMap.replaceShipPiece(use.ship, piece)
                return { piece }
            }
        }
    }

    // Every power the player may use now, one by one.
    *powerUses(playerId: string): Generator<PowerUse> {
        for (const system of [...this.starMap.systems]) {
            if (!this.starMap.hasShipIn(system, playerId)) continue
            yield* this.powerUsesIn(system, playerId)
        }
    }

    hasPowerUse(playerId: string): boolean {
        return !this.powerUses(playerId).next().done
    }

    canSacrifice(playerId: string, piece: number): boolean {
        return this.machineState === MachineState.TakingTurn && this.ownsShip(playerId, piece)
    }

    // A sacrifice gives as many actions of the ship's colour as it has pips.
    sacrificeShip(piece: number): { systemId: number; abandonedStars: number[] } {
        const { system, abandoned } = this.starMap.removeShip(piece)
        this.sacrifice = { color: pieceColor(piece), remaining: pieceSize(piece) }
        return { systemId: system.id, abandonedStars: abandoned ? system.stars : [] }
    }

    canDeclareCatastrophe(systemId: number, color: PyramidColor): boolean {
        return this.starMap
            .overpopulations()
            .some((over) => over.systemId === systemId && over.color === color)
    }

    hasCatastrophe(): boolean {
        return this.starMap.overpopulations().length > 0
    }

    declareCatastrophe(systemId: number, color: PyramidColor): Destroyed {
        assert(this.canDeclareCatastrophe(systemId, color), 'The system is not overpopulated')
        return this.starMap.catastrophe(systemId, color)
    }

    // A player whose homeworld is gone, or who has no ship there, is out.
    isOut(playerId: string): boolean {
        const home = this.starMap.homeworldOf(playerId)
        return home === undefined || !this.starMap.hasShipIn(home, playerId)
    }

    // Records the position the player to move faces and says whether it has come round often
    // enough to draw the game.
    recordPosition(playerId: string): boolean {
        const hash = this.positionHash(playerId)
        this.positions.push(hash)
        return this.positions.filter((other) => other === hash).length >= REPETITIONS_TO_DRAW
    }

    // Systems by what is in them, pieces by colour and size rather than id, so the same position
    // reached with other copies of a piece counts as the same.
    positionHash(playerId: string): number {
        const kind = (piece: number) => `${pieceColor(piece)}${pieceSize(piece)}`
        const systems = this.starMap.systems
            .map((system) => {
                const home =
                    system.homeworldOf === undefined ? '-' : String(this.seatOf(system.homeworldOf))
                const stars = system.stars.map(kind).toSorted().join(',')
                const ships = system.ships
                    .map((ship: Ship) => `${this.seatOf(ship.ownerId)}${kind(ship.piece)}`)
                    .toSorted()
                    .join(',')
                return `${home}:${stars}:${ships}`
            })
            .toSorted()
        return addToChecksum(0, [[...systems, '|', String(this.seatOf(playerId))].join(' ')])
    }

    declareWinner(playerId: string) {
        this.winningPlayerIds = [playerId]
        this.endReason = EndReason.Eliminated
    }

    declareDraw(reason: EndReason.BothEliminated | EndReason.Repetition) {
        this.winningPlayerIds = this.players.map((player) => player.playerId)
        this.endReason = reason
    }

    private homeworldPieces(
        stars: PieceKind[],
        shipColor: PyramidColor
    ): { stars: number[]; ship: number } | undefined {
        const taken: number[] = []
        for (const kind of [...stars, { color: shipColor, size: PyramidSize.Large }]) {
            const piece = this.starMap
                .bank()
                .find(
                    (candidate) =>
                        !taken.includes(candidate) &&
                        pieceColor(candidate) === kind.color &&
                        pieceSize(candidate) === kind.size
                )
            if (piece === undefined) return undefined
            taken.push(piece)
        }
        const [first, second, ship] = taken
        assertExists(first, 'A homeworld has two stars')
        assertExists(second, 'A homeworld has two stars')
        assertExists(ship, 'A homeworld comes with a ship')
        return { stars: [first, second], ship }
    }

    private ownsShip(playerId: string, piece: number): boolean {
        return isPieceId(piece) && this.starMap.ship(piece)?.ownerId === playerId
    }

    private *powerUsesIn(system: StarSystem, playerId: string): Generator<PowerUse> {
        const own = this.starMap.ownShips(system, playerId)
        const has = (color: PyramidColor) => this.hasPower(playerId, color, system)
        if (has(PyramidColor.Green)) {
            for (const color of new Set(own.map((ship) => pieceColor(ship.piece)))) {
                if (this.starMap.smallestInBank(color) !== undefined) {
                    yield { power: Power.Build, systemId: system.id, color }
                }
            }
        }
        if (has(PyramidColor.Yellow)) {
            const discoverable = uniqueKinds(this.starMap.bank()).filter((kind) =>
                this.starMap.canDiscoverFrom(system.id, kind.size)
            )
            for (const ship of own) {
                for (const to of this.starMap.connectedSystems(system.id)) {
                    yield { power: Power.Move, ship: ship.piece, systemId: to.id }
                }
                for (const star of discoverable) {
                    yield { power: Power.Discover, ship: ship.piece, star }
                }
            }
        }
        if (has(PyramidColor.Red)) {
            const reach = this.starMap.largestOwnSize(system, playerId)
            for (const ship of system.ships) {
                if (ship.ownerId !== playerId && pieceSize(ship.piece) <= reach) {
                    yield { power: Power.Capture, ship: ship.piece }
                }
            }
        }
        if (has(PyramidColor.Blue)) {
            for (const ship of own) {
                for (const color of PYRAMID_COLORS) {
                    if (
                        color !== pieceColor(ship.piece) &&
                        this.starMap.bankPiece({ color, size: pieceSize(ship.piece) }) !== undefined
                    ) {
                        yield { power: Power.Trade, ship: ship.piece, color }
                    }
                }
            }
        }
    }
}

function uniqueKinds(pieces: number[]): PieceKind[] {
    const seen = new Map<string, PieceKind>()
    for (const piece of pieces) {
        const kind = { color: pieceColor(piece), size: pieceSize(piece) }
        seen.set(`${kind.color}${kind.size}`, kind)
    }
    return [...seen.values()]
}
