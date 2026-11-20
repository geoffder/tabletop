import {
    GameSession,
    type TitlePreferences,
    undoableStagedSelection
} from '@tabletop/frontend-components'
import {
    ActionType,
    areAdjacent,
    Axis,
    BuildBridge,
    BuildTemple,
    type Cell,
    ChooseStart,
    DigCanal,
    EndTurn,
    FoundDistrict,
    type HydratedMexicaGameState,
    LAND_CELLS,
    type Level,
    LEVELS,
    type MexicaGameState,
    MexicaPreferenceDefinition,
    type MexicaPreferences,
    type Move,
    MoveBridge,
    MovePilli,
    START_CELLS,
    TakeToken
} from '@tabletop/mexica'
import {
    setMexicaSelection,
    MexicaStageOrder,
    type MexicaSelection,
    type Tool
} from './stagedSelection.js'
import { boardView, type BoardView, quarterTurnsOf } from '$lib/board/view.js'
import { PIGMENTS } from './palette.js'

type SessionOptions = ConstructorParameters<
    typeof GameSession<MexicaGameState, HydratedMexicaGameState>
>[0]

const AXES = [Axis.NorthSouth, Axis.EastWest]

export class MexicaGameSession extends GameSession<MexicaGameState, HydratedMexicaGameState> {
    selection: MexicaSelection = $state({})
    // Anyone but the selection's owner, as the harness's Non-active view can be after an Undo,
    // sees none of it, and Undo passes it by.
    private selectionOwner: string | undefined = $state()
    private ownSelection: MexicaSelection = $derived(
        this.selectionOwner !== undefined && this.selectionOwner === this.myPlayer?.id
            ? this.selection
            : {}
    )

    constructor(options: SessionOptions) {
        super(options)
        this.localSelections.register(
            undoableStagedSelection(
                MexicaStageOrder,
                () => this.ownSelection,
                (selection) => this.select(selection)
            )
        )
    }

    readonly preferences: TitlePreferences<typeof MexicaPreferences> = this.createPreferences(
        MexicaPreferenceDefinition
    )

    showCoordinates: boolean = $derived(this.preferences.values.showCoordinates)
    flatBoard: boolean = $derived(this.preferences.values.flatBoard)
    rotatedBoard: boolean = $derived(this.preferences.values.rotatedBoard)
    farSide: boolean = $derived(this.preferences.values.farSide)

    view: BoardView = $derived(
        boardView(this.flatBoard, quarterTurnsOf(this.rotatedBoard, this.farSide))
    )

    // A player asking for the colourblind palette keeps the site's colours for it.
    playerFill(playerId?: string): string {
        if (this.colors.colorBlind) return this.colors.getPlayerBgColorValue(playerId)
        return PIGMENTS[this.colors.getPlayerColor(playerId)].fill
    }

    playerInk(playerId?: string): string {
        if (this.colors.colorBlind) return this.colors.getPlayerTextColorValue(playerId)
        return PIGMENTS[this.colors.getPlayerColor(playerId)].ink
    }

    toggleCoordinates() {
        this.preferences.set({ showCoordinates: !this.showCoordinates })
    }

    toggleFlatBoard() {
        this.preferences.set({ flatBoard: !this.flatBoard })
    }

    toggleRotatedBoard() {
        this.preferences.set({ rotatedBoard: !this.rotatedBoard })
    }

    toggleFarSide() {
        this.preferences.set({ farSide: !this.farSide })
    }

    canChooseStart = $derived(this.canAct(ActionType.ChooseStart))
    canEndTurn = $derived(this.canAct(ActionType.EndTurn))
    canTakeToken = $derived(this.canAct(ActionType.TakeToken))
    canFound = $derived(this.canAct(ActionType.FoundDistrict))
    isActing = $derived(this.canEndTurn)

    tool: Tool | undefined = $derived(this.ownSelection.tool?.value)
    chosenCell: Cell | undefined = $derived(this.ownSelection.cell?.value)
    chosenDestination: Cell | undefined = $derived(this.ownSelection.destination?.value)

    private me: string | undefined = $derived(this.myPlayer?.id)

    apLeft: number = $derived(this.gameState.apLeft)
    apAvailable: number = $derived(
        this.me !== undefined && this.isActing ? this.gameState.apAvailable(this.me) : 0
    )

    startCells: ReadonlySet<Cell> = $derived(
        new Set(
            this.canChooseStart ? START_CELLS.filter((cell) => this.gameState.canStartOn(cell)) : []
        )
    )

    // Where the Pilli Mexica can go now, and for how much.
    moves: ReadonlyMap<Cell, Move> = $derived.by(() => {
        const playerId = this.me
        if (!this.isActing || playerId === undefined || this.tool !== undefined) return new Map()
        const state = this.gameState
        const ap = state.apAvailable(playerId)
        const moves = new Map<Cell, Move>()
        for (const [cell, move] of state.moves(playerId)) {
            if (move.cost > ap) continue
            if (!state.leavesEveryoneFree(playerId, (s) => s.placePilli(playerId, cell))) continue
            moves.set(cell, move)
        }
        return moves
    })

    templeLevels: readonly Level[] = $derived(
        this.me === undefined || !this.isActing
            ? []
            : LEVELS.filter(
                  (level) =>
                      this.apAvailable >= level &&
                      this.gameState.templesLeft(this.me ?? '', level) > 0
              )
    )

    canDig: boolean = $derived(
        this.isActing && this.apAvailable >= 1 && this.gameState.canalTilesLeft() > 0
    )
    canBuildBridge: boolean = $derived(
        this.isActing && this.apAvailable >= 1 && this.gameState.bridgesLeft() > 0
    )
    canMoveBridge: boolean = $derived(
        this.isActing && this.apAvailable >= 1 && this.gameState.bridgesLeft() === 0
    )

    // The spaces the picked-up tool can go on now.
    targets: ReadonlySet<Cell> = $derived.by(() => {
        const playerId = this.me
        const tool = this.tool
        if (!this.isActing || playerId === undefined || tool === undefined) return new Set()
        const state = this.gameState
        const free = (change: (s: HydratedMexicaGameState) => void) =>
            state.leavesEveryoneFree(playerId, change)
        if (typeof tool === 'number') {
            return new Set(
                LAND_CELLS.filter(
                    (cell) =>
                        state.canBuildTemple(playerId, cell, tool) &&
                        free((s) => s.buildTemple(playerId, cell, tool))
                )
            )
        }
        if (tool === 'found') {
            return new Set(
                LAND_CELLS.filter(
                    (cell) => state.canFound(playerId, cell) && free((s) => s.found(playerId, cell))
                )
            )
        }
        if (tool === 'canal') return this.canalTargets(state, playerId)
        if (tool === 'bridge') {
            return new Set(
                [...state.layout().canals].filter((cell) =>
                    AXES.some((axis) => state.canBuildBridge(cell, axis))
                )
            )
        }
        const moving = this.chosenCell
        if (moving === undefined) {
            const layout = state.layout()
            return new Set(
                state.bridges
                    .filter((bridge) => !layout.pillis.has(bridge.cell))
                    .map((bridge) => bridge.cell)
            )
        }
        const bridgeId = state.bridges.findIndex((bridge) => bridge.cell === moving)
        return new Set(
            [...state.layout().canals].filter((cell) =>
                AXES.some(
                    (axis) =>
                        state.canMoveBridge(bridgeId, cell, axis) &&
                        free((s) => s.moveBridge(bridgeId, cell, axis))
                )
            )
        )
    })

    // A bridge whose canal takes it either way waits for the player to choose.
    axisChoices: readonly Axis[] = $derived.by(() => {
        const state = this.gameState
        if (this.tool === 'bridge' && this.chosenCell !== undefined) {
            const cell = this.chosenCell
            return AXES.filter((axis) => state.canBuildBridge(cell, axis))
        }
        if (
            this.tool === 'moveBridge' &&
            this.chosenCell !== undefined &&
            this.chosenDestination !== undefined
        ) {
            const bridgeId = this.bridgeIdAt(this.chosenCell)
            const cell = this.chosenDestination
            return AXES.filter((axis) => state.canMoveBridge(bridgeId, cell, axis))
        }
        return []
    })

    private canAct(type: ActionType): boolean {
        return !this.isViewingHistory && this.isMyTurn && this.validActionTypes.includes(type)
    }

    private canalTargets(state: HydratedMexicaGameState, playerId: string): Set<Cell> {
        const layout = state.layout()
        const diggable = LAND_CELLS.filter((cell) => state.canDigAt(cell, layout))
        const first = this.chosenCell
        const singles = state.singleCanalsLeft() > 0
        const doubles = state.doubleCanalsLeft() > 0
        const allowed = (cells: Cell[]) => state.leavesEveryoneFree(playerId, (s) => s.dig(cells))
        if (first !== undefined) {
            const seconds = diggable.filter(
                (cell) => doubles && areAdjacent(first, cell) && allowed([first, cell])
            )
            return new Set(singles && allowed([first]) ? [first, ...seconds] : seconds)
        }
        return new Set(
            diggable.filter(
                (cell) =>
                    (singles && allowed([cell])) ||
                    (doubles &&
                        diggable.some(
                            (other) => areAdjacent(cell, other) && allowed([cell, other])
                        ))
            )
        )
    }

    private bridgeIdAt(cell: Cell): number {
        return this.gameState.bridges.findIndex((bridge) => bridge.cell === cell)
    }

    pickTool(tool: Tool) {
        if (this.updatingVisibleState || !this.isActing) return
        this.select(this.tool === tool ? {} : setMexicaSelection({}, 'tool', tool))
    }

    // Tapping where there is nothing to choose lets go of what was picked up.
    letGo() {
        if (this.updatingVisibleState || this.tool === undefined) return
        this.select({})
    }

    async chooseCell(cell: Cell) {
        if (this.updatingVisibleState) return
        if (this.canChooseStart) {
            if (this.startCells.has(cell)) {
                await this.applyAction(this.createPlayerAction(ChooseStart, { cell }))
            }
            return
        }
        const tool = this.tool
        if (tool === undefined) {
            if (this.moves.has(cell)) {
                await this.applyAction(this.createPlayerAction(MovePilli, { to: cell }))
            }
            return
        }
        if (!this.targets.has(cell)) {
            this.letGo()
            return
        }
        if (typeof tool === 'number') {
            await this.applyAction(this.createPlayerAction(BuildTemple, { cell, level: tool }))
        } else if (tool === 'found') {
            await this.applyAction(this.createPlayerAction(FoundDistrict, { cell }))
        } else if (tool === 'canal') {
            await this.chooseCanalCell(cell)
        } else if (tool === 'bridge') {
            await this.chooseBridgeCell(cell)
        } else {
            await this.chooseMovedBridgeCell(cell)
        }
    }

    private async chooseCanalCell(cell: Cell) {
        const first = this.chosenCell
        if (first === undefined) {
            const state = this.gameState
            const layout = state.layout()
            const pairs = LAND_CELLS.some(
                (other) =>
                    state.doubleCanalsLeft() > 0 &&
                    areAdjacent(cell, other) &&
                    state.canDigAt(other, layout)
            )
            if (!pairs) {
                await this.digCanal([cell])
                return
            }
            this.select(setMexicaSelection(this.ownSelection, 'cell', cell))
            return
        }
        await this.digCanal(first === cell ? [cell] : [first, cell])
    }

    async digCanal(cells: Cell[]) {
        await this.applyAction(this.createPlayerAction(DigCanal, { cells }))
    }

    private async chooseBridgeCell(cell: Cell) {
        const axes = AXES.filter((axis) => this.gameState.canBuildBridge(cell, axis))
        if (axes.length === 1) {
            await this.applyAction(this.createPlayerAction(BuildBridge, { cell, axis: axes[0] }))
            return
        }
        this.select(setMexicaSelection(this.ownSelection, 'cell', cell))
    }

    private async chooseMovedBridgeCell(cell: Cell) {
        const moving = this.chosenCell
        if (moving === undefined) {
            this.select(setMexicaSelection(this.ownSelection, 'cell', cell))
            return
        }
        const bridgeId = this.bridgeIdAt(moving)
        const axes = AXES.filter((axis) => this.gameState.canMoveBridge(bridgeId, cell, axis))
        if (axes.length === 1) {
            await this.applyAction(
                this.createPlayerAction(MoveBridge, { bridgeId, cell, axis: axes[0] })
            )
            return
        }
        this.select(setMexicaSelection(this.ownSelection, 'destination', cell))
    }

    async chooseAxis(axis: Axis) {
        if (this.updatingVisibleState || !this.axisChoices.includes(axis)) return
        if (this.tool === 'bridge' && this.chosenCell !== undefined) {
            await this.applyAction(
                this.createPlayerAction(BuildBridge, { cell: this.chosenCell, axis })
            )
        } else if (this.chosenCell !== undefined && this.chosenDestination !== undefined) {
            const bridgeId = this.bridgeIdAt(this.chosenCell)
            const cell = this.chosenDestination
            await this.applyAction(this.createPlayerAction(MoveBridge, { bridgeId, cell, axis }))
        }
    }

    async takeToken() {
        if (this.updatingVisibleState || !this.canTakeToken) return
        await this.applyAction(this.createPlayerAction(TakeToken, {}))
    }

    async endTurn() {
        if (this.updatingVisibleState || !this.canEndTurn) return
        await this.applyAction(this.createPlayerAction(EndTurn, {}))
    }

    private select(selection: MexicaSelection) {
        this.selection = selection
        this.selectionOwner = this.myPlayer?.id
    }
}
