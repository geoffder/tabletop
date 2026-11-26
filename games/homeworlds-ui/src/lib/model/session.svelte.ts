import {
    GameSession,
    type PresentedTransition,
    type TitlePreferences,
    undoableStagedSelection
} from '@tabletop/frontend-components'
import {
    ActionType,
    Build,
    Capture,
    Catastrophe,
    CreateHomeworld,
    Discover,
    EndTurn,
    HomeworldsPreferenceDefinition,
    MachineState,
    Move,
    type Overpopulation,
    type PieceKind,
    pieceColor,
    pieceSize,
    Power,
    type PowerUse,
    type StarSystem,
    PyramidColor,
    PyramidSize,
    Sacrifice,
    sameKind,
    Trade,
    type HomeworldsGameState,
    type HomeworldsPreferences,
    type HydratedHomeworldsGameState
} from '@tabletop/homeworlds'
import { boardView, type BoardView } from '$lib/board/view.js'
import { tableLayout, type TableLayout } from '$lib/board/layout.js'
import {
    chosenPower,
    chosenShip,
    chosenShipColor,
    chosenStars,
    HomeworldStageOrder,
    type HomeworldSelection,
    ShipPower,
    TurnStageOrder,
    type TurnSelection,
    withPower,
    withShip,
    withShipColor,
    withStar
} from './selection.js'

// Lets the session stop the move the board animator is playing.
export type MoveInterrupter = {
    // Lands the move at once; the rest of its replay still plays.
    interrupt(): void
    // Lands it and drops the rest of its replay: another state is being shown.
    abandon(): void
}

type SessionOptions = ConstructorParameters<
    typeof GameSession<HomeworldsGameState, HydratedHomeworldsGameState>
>[0]

const POWER_OF: Record<Power, ShipPower> = {
    [Power.Move]: ShipPower.Travel,
    [Power.Discover]: ShipPower.Travel,
    [Power.Build]: ShipPower.Build,
    [Power.Trade]: ShipPower.Trade,
    [Power.Capture]: ShipPower.Capture
}

export const SHIP_POWER_COLOR: Record<ShipPower, PyramidColor | undefined> = {
    [ShipPower.Travel]: PyramidColor.Yellow,
    [ShipPower.Build]: PyramidColor.Green,
    [ShipPower.Trade]: PyramidColor.Blue,
    [ShipPower.Capture]: PyramidColor.Red,
    [ShipPower.Sacrifice]: undefined
}

const POWER_ORDER = [
    ShipPower.Travel,
    ShipPower.Build,
    ShipPower.Trade,
    ShipPower.Capture,
    ShipPower.Sacrifice
]

export class HomeworldsGameSession extends GameSession<
    HomeworldsGameState,
    HydratedHomeworldsGameState
> {
    moveInterrupter: MoveInterrupter | undefined

    readonly preferences: TitlePreferences<typeof HomeworldsPreferences> = this.createPreferences(
        HomeworldsPreferenceDefinition
    )

    // The table seen from straight above rather than from the near side.
    flatBoard: boolean = $derived(this.preferences.values.flatBoard)

    toggleFlatBoard() {
        this.moveInterrupter?.interrupt()
        this.preferences.set({ flatBoard: !this.flatBoard })
    }

    view: BoardView = $derived(boardView(this.flatBoard))

    // The map turned a quarter: homeworlds in the lower right and upper left corners.
    turnedBoard: boolean = $derived(this.preferences.values.turnedBoard)

    toggleTurnedBoard() {
        this.moveInterrupter?.interrupt()
        this.preferences.set({ turnedBoard: !this.turnedBoard })
    }

    // The viewer's homeworld is nearest them; a spectator sits on the first player's side.
    nearId: string | undefined = $derived(
        this.myPlayer?.id ?? this.gameState.turnManager.turnOrder[0]
    )
    farId: string | undefined = $derived(
        this.gameState.players.find((player) => player.playerId !== this.nearId)?.playerId
    )

    // The map as shown: the homeworld being built stands at home before it is committed.
    private shownSystems: StarSystem[] = $derived.by(() => {
        const preview = this.homeworldPreview
        return preview
            ? [...this.gameState.starMap.systems, preview]
            : this.gameState.starMap.systems
    })

    shownBank: number[] = $derived.by(() => {
        const preview = this.homeworldPreview
        if (!preview) return this.gameState.starMap.bank()
        const taken = new Set([...preview.stars, ...preview.ships.map((ship) => ship.piece)])
        return this.gameState.starMap.bank().filter((piece) => !taken.has(piece))
    })

    layout: TableLayout = $derived(
        tableLayout(
            this.shownSystems,
            { nearId: this.nearId, farId: this.farId },
            this.view,
            this.turnedBoard
        )
    )

    // The selection is the player's who made it: in hotseat the other player never inherits it.
    private selectionOwner: string | undefined = $state(undefined)
    private turnSelection: TurnSelection = $state({})
    private homeworldSelection: HomeworldSelection = $state({})

    private ownTurnSelection: TurnSelection = $derived(
        this.selectionOwner === this.myPlayer?.id ? this.turnSelection : {}
    )
    private ownHomeworldSelection: HomeworldSelection = $derived(
        this.selectionOwner === this.myPlayer?.id ? this.homeworldSelection : {}
    )

    constructor(options: SessionOptions) {
        super(options)
        this.localSelections.register(
            undoableStagedSelection(
                HomeworldStageOrder,
                () => this.ownHomeworldSelection,
                (selection) => this.selectHomeworld(selection)
            )
        )
        this.localSelections.register(
            undoableStagedSelection(
                TurnStageOrder,
                () => this.ownTurnSelection,
                (selection) => this.selectTurn(selection)
            )
        )
    }

    get presentingState(): HydratedHomeworldsGameState | undefined {
        return this.incomingGameState
    }

    override beforeNewState({ kind }: PresentedTransition): void {
        if (kind === 'view-switch') this.moveInterrupter?.abandon()
    }

    private selectTurn(selection: TurnSelection) {
        this.selectionOwner = this.myPlayer?.id
        this.turnSelection = selection
    }

    private selectHomeworld(selection: HomeworldSelection) {
        this.selectionOwner = this.myPlayer?.id
        this.homeworldSelection = selection
    }

    private canAct(type: ActionType): boolean {
        return !this.isViewingHistory && this.isMyTurn && this.validActionTypes.includes(type)
    }

    canCreateHomeworld = $derived(this.canAct(ActionType.CreateHomeworld))
    canEndTurn = $derived(this.canAct(ActionType.EndTurn))
    canDeclare = $derived(this.canAct(ActionType.Catastrophe))

    overpopulations: Overpopulation[] = $derived(
        this.canDeclare ? this.gameState.starMap.overpopulations() : []
    )

    // Every power the player could use now.
    private uses: PowerUse[] = $derived(
        this.myPlayer && this.canAct(ActionType.Move)
            ? [...this.gameState.powerUses(this.myPlayer.id)]
            : []
    )

    private canSacrifice = $derived(this.canAct(ActionType.Sacrifice))

    // What each of the player's ships could do.
    shipPowers: ReadonlyMap<number, ShipPower[]> = $derived.by(() => {
        const powers = new Map<number, Set<ShipPower>>()
        const me = this.myPlayer?.id
        if (me === undefined) return new Map()
        const add = (ship: number, power: ShipPower) => {
            const set = powers.get(ship) ?? new Set<ShipPower>()
            set.add(power)
            powers.set(ship, set)
        }
        const starMap = this.gameState.starMap
        for (const system of starMap.systems) {
            for (const ship of starMap.ownShips(system, me)) {
                for (const use of this.uses) {
                    if (this.usesShip(use, ship.piece, system.id))
                        add(ship.piece, POWER_OF[use.power])
                }
                if (this.canSacrifice) add(ship.piece, ShipPower.Sacrifice)
            }
        }
        return new Map(
            [...powers].map(([ship, set]) => [ship, POWER_ORDER.filter((power) => set.has(power))])
        )
    })

    // A ship can travel, trade or be the size behind a capture in its own system, or build its
    // own colour there.
    private usesShip(use: PowerUse, ship: number, systemId: number): boolean {
        switch (use.power) {
            case Power.Build:
                return use.systemId === systemId && use.color === pieceColor(ship)
            case Power.Capture:
                return this.gameState.starMap.systemOfShip(use.ship)?.id === systemId
            default:
                return use.ship === ship
        }
    }

    selectedShip: number | undefined = $derived.by(() => {
        const ship = chosenShip(this.ownTurnSelection)
        return ship !== undefined && this.shipPowers.has(ship) ? ship : undefined
    })

    selectedPower: ShipPower | undefined = $derived(
        this.selectedShip === undefined ? undefined : chosenPower(this.ownTurnSelection)
    )

    selectedShipPowers: ShipPower[] = $derived(
        this.selectedShip === undefined ? [] : (this.shipPowers.get(this.selectedShip) ?? [])
    )

    private shipUses: PowerUse[] = $derived.by(() => {
        const ship = this.selectedShip
        if (ship === undefined) return []
        const systemId = this.gameState.starMap.systemOfShip(ship)?.id
        return this.uses.filter(
            (use) =>
                systemId !== undefined &&
                this.usesShip(use, ship, systemId) &&
                POWER_OF[use.power] === this.selectedPower
        )
    })

    moveTargets: ReadonlySet<number> = $derived(
        new Set(this.shipUses.flatMap((use) => (use.power === Power.Move ? [use.systemId] : [])))
    )

    discoverTargets: PieceKind[] = $derived(
        this.shipUses.flatMap((use) => (use.power === Power.Discover ? [use.star] : []))
    )

    tradeTargets: PyramidColor[] = $derived(
        this.shipUses.flatMap((use) => (use.power === Power.Trade ? [use.color] : []))
    )

    captureTargets: ReadonlySet<number> = $derived(
        new Set(this.shipUses.flatMap((use) => (use.power === Power.Capture ? [use.ship] : [])))
    )

    // The Bank's towers the player may tap now, each with what a tap does.
    towerTargets: ReadonlyMap<string, 'discover' | 'trade' | 'star' | 'ship'> = $derived.by(() => {
        const targets = new Map<string, 'discover' | 'trade' | 'star' | 'ship'>()
        if (this.canCreateHomeworld) {
            for (const kind of this.homeworldChoices) targets.set(towerKey(kind), kind.role)
            return targets
        }
        for (const star of this.discoverTargets) targets.set(towerKey(star), 'discover')
        const ship = this.selectedShip
        if (ship !== undefined) {
            for (const color of this.tradeTargets) {
                targets.set(towerKey({ color, size: pieceSize(ship) }), 'trade')
            }
        }
        return targets
    })

    // Building a homeworld: two stars from the Bank, then a Large ship.
    homeworldStars: PieceKind[] = $derived(chosenStars(this.ownHomeworldSelection))
    homeworldShipColor: PyramidColor | undefined = $derived(
        chosenShipColor(this.ownHomeworldSelection)
    )

    private homeworldChoices: (PieceKind & { role: 'star' | 'ship' })[] = $derived.by(() => {
        const me = this.myPlayer?.id
        if (me === undefined) return []
        const stars = this.homeworldStars
        const bank = this.gameState.starMap.bank()
        const left = (kind: PieceKind) =>
            bank.filter(
                (piece) => pieceColor(piece) === kind.color && pieceSize(piece) === kind.size
            ).length - stars.filter((star) => sameKind(star, kind)).length
        const kinds = bank
            .map((piece) => ({ color: pieceColor(piece), size: pieceSize(piece) }))
            .filter((kind, index, all) => all.findIndex((other) => sameKind(other, kind)) === index)
        if (stars.length < 2) {
            return kinds.filter((kind) => left(kind) > 0).map((kind) => ({ ...kind, role: 'star' }))
        }
        if (this.homeworldShipColor !== undefined) return []
        return kinds
            .filter((kind) => kind.size === PyramidSize.Large && left(kind) > 0)
            .map((kind) => ({ ...kind, role: 'ship' }))
    })

    // Sizes matching the opponent's homeworld, or both stars one size, shrink the universe.
    smallUniverse: boolean = $derived.by(() => {
        const [first, second] = this.homeworldStars
        if (first === undefined || second === undefined) return false
        if (first.size === second.size) return true
        const other = this.gameState.starMap.systems.find(
            (system) => system.homeworldOf !== undefined && system.homeworldOf !== this.myPlayer?.id
        )
        if (other === undefined) return false
        const theirs = other.stars.map(pieceSize).toSorted()
        return [first.size, second.size].toSorted().join() === theirs.join()
    })

    // The stars and ship chosen so far, as the Bank's first free pieces of each kind.
    private homeworldPreview: StarSystem | undefined = $derived.by(() => {
        const me = this.myPlayer?.id
        if (me === undefined || !this.canCreateHomeworld || this.homeworldStars.length === 0) {
            return undefined
        }
        const bank = this.gameState.starMap.bank()
        const taken: number[] = []
        const take = (kind: PieceKind) => {
            const piece = bank.find(
                (candidate) =>
                    !taken.includes(candidate) &&
                    pieceColor(candidate) === kind.color &&
                    pieceSize(candidate) === kind.size
            )
            if (piece !== undefined) taken.push(piece)
            return piece
        }
        const stars = this.homeworldStars.flatMap((kind) => {
            const piece = take(kind)
            return piece === undefined ? [] : [piece]
        })
        const color = this.homeworldShipColor
        const ship = color === undefined ? undefined : take({ color, size: PyramidSize.Large })
        return {
            id: this.gameState.homeworldSystemId(me),
            stars,
            homeworldOf: me,
            ships: ship === undefined ? [] : [{ piece: ship, ownerId: me }]
        }
    })

    homeworldReady: boolean = $derived(
        this.homeworldStars.length === 2 && this.homeworldShipColor !== undefined
    )

    sacrificeColor: PyramidColor | undefined = $derived(this.gameState.sacrifice?.color)
    sacrificeLeft: number = $derived(this.gameState.sacrifice?.remaining ?? 0)

    // Whether ending the turn now would leave the player without a ship at home.
    endingLoses: boolean = $derived(
        this.myPlayer !== undefined && this.canEndTurn && this.gameState.isOut(this.myPlayer.id)
    )

    // Taps on the board while a committed move is still being shown are ignored.
    private get quiet(): boolean {
        return this.updatingVisibleState
    }

    selectShip(ship: number) {
        if (this.quiet) return
        const powers = this.shipPowers.get(ship)
        if (powers === undefined) return
        if (this.selectedShip === ship && this.selectedPower === undefined) {
            this.letGo()
            return
        }
        let selection = withShip(this.ownTurnSelection, ship)
        const [only] = powers
        // A sacrifice's colour leaves one thing a ship can do; build at once when that is all.
        if (powers.length === 1 && only !== undefined) {
            if (
                only === ShipPower.Build &&
                this.gameState.machineState === MachineState.SacrificeActions
            ) {
                this.selectTurn({})
                this.build(ship)
                return
            }
            if (only !== ShipPower.Sacrifice && only !== ShipPower.Build) {
                selection = withPower(selection, only, 'auto')
            }
        }
        this.selectTurn(selection)
    }

    choosePower(power: ShipPower) {
        const ship = this.selectedShip
        if (this.quiet || ship === undefined || !this.selectedShipPowers.includes(power)) return
        if (power === ShipPower.Build) {
            this.build(ship)
        } else if (power === ShipPower.Sacrifice) {
            this.sacrifice(ship)
        } else {
            this.selectTurn(withPower(this.ownTurnSelection, power, 'manual'))
        }
    }

    // A tap away from every choice lets go of the ship; Undo does the same from the keyboard.
    letGo() {
        if (this.quiet) return
        if (chosenShip(this.ownTurnSelection) !== undefined) this.selectTurn({})
    }

    tapTower(kind: PieceKind) {
        if (this.quiet) return
        const role = this.towerTargets.get(towerKey(kind))
        const ship = this.selectedShip
        if (role === 'star') {
            this.selectHomeworld(withStar(this.ownHomeworldSelection, kind))
        } else if (role === 'ship') {
            this.selectHomeworld(withShipColor(this.ownHomeworldSelection, kind.color))
        } else if (role === 'discover' && ship !== undefined) {
            this.act(this.createPlayerAction(Discover, { ship, star: kind }))
        } else if (role === 'trade' && ship !== undefined) {
            this.act(this.createPlayerAction(Trade, { ship, color: kind.color }))
        }
    }

    moveTo(systemId: number) {
        const ship = this.selectedShip
        if (this.quiet || ship === undefined || !this.moveTargets.has(systemId)) return
        this.act(this.createPlayerAction(Move, { ship, systemId }))
    }

    capture(target: number) {
        if (this.quiet || !this.captureTargets.has(target)) return
        this.act(this.createPlayerAction(Capture, { ship: target }))
    }

    private build(ship: number) {
        const systemId = this.gameState.starMap.systemOfShip(ship)?.id
        if (systemId === undefined) return
        this.act(this.createPlayerAction(Build, { systemId, color: pieceColor(ship) }))
    }

    private sacrifice(ship: number) {
        this.act(this.createPlayerAction(Sacrifice, { ship }))
    }

    declareCatastrophe(systemId: number, color: PyramidColor) {
        if (
            this.quiet ||
            !this.overpopulations.some((over) => over.systemId === systemId && over.color === color)
        ) {
            return
        }
        this.act(this.createPlayerAction(Catastrophe, { systemId, color }))
    }

    endTurn() {
        if (this.quiet || !this.canEndTurn) return
        this.act(this.createPlayerAction(EndTurn, {}))
    }

    createHomeworld() {
        const color = this.homeworldShipColor
        if (this.quiet || !this.canCreateHomeworld || color === undefined) return
        this.act(
            this.createPlayerAction(CreateHomeworld, {
                stars: this.homeworldStars,
                shipColor: color
            })
        )
    }

    private act(action: Parameters<typeof this.applyAction>[0]) {
        void this.applyAction(action)
    }
}

export function towerKey(kind: PieceKind): string {
    return `${kind.color}${kind.size}`
}
