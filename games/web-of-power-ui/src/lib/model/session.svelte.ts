import { isCascadedSystemAction, type GameAction } from '@tabletop/common'
import {
    GameSession,
    undoableStagedSelection,
    type PresentedTransition
} from '@tabletop/frontend-components'
import {
    ActionType,
    CARD_COUNTRIES,
    CardColor,
    Country,
    DrawFaceUp,
    DrawFromDeck,
    EndPlacing,
    ExchangeCard,
    fasterVariantFromConfig,
    openDiscardFromConfig,
    Pass,
    PlacePiece,
    PieceKind,
    type HydratedWebOfPowerGameState,
    type PieceTarget,
    type WebOfPowerProjectedState
} from '@tabletop/web-of-power'
import {
    setWebOfPowerSelection,
    WebOfPowerStageOrder,
    type WebOfPowerSelection
} from './stagedSelection.js'

export type MoveInterrupter = {
    // Lands the move at once; the rest of its replay still plays.
    interrupt(): void
    // Lands it and drops the rest of its replay: another state is being shown.
    abandon(): void
}

type SessionOptions = ConstructorParameters<
    typeof GameSession<WebOfPowerProjectedState, HydratedWebOfPowerGameState>
>[0]

export class WebOfPowerGameSession extends GameSession<
    WebOfPowerProjectedState,
    HydratedWebOfPowerGameState
> {
    selection: WebOfPowerSelection = $state({})
    // Another viewer (the harness's other seats, after an Undo) sees none of it.
    private selectionOwner: string | undefined = $state()
    private ownSelection: WebOfPowerSelection = $derived(
        this.selectionOwner !== undefined && this.selectionOwner === this.myPlayer?.id
            ? this.selection
            : {}
    )

    constructor(options: SessionOptions) {
        super(options)
        this.localSelections.register(
            undoableStagedSelection(
                WebOfPowerStageOrder,
                () => this.ownSelection,
                (selection) => this.select(selection)
            )
        )
    }

    readonly moveInterrupters = new Set<MoveInterrupter>()

    get presentingState(): HydratedWebOfPowerGameState | undefined {
        return this.incomingGameState
    }

    override beforeNewState({ kind }: PresentedTransition): void {
        if (kind === 'view-switch') for (const animator of this.moveInterrupters) animator.abandon()
    }

    // The market's refill closes a turn, so a history step takes the system actions after a move.
    override shouldAutoStepAction(_action: GameAction, next?: GameAction): boolean {
        return next !== undefined && isCascadedSystemAction(next)
    }

    faster: boolean = $derived(fasterVariantFromConfig(this.game.config))
    openDiscard: boolean = $derived(openDiscardFromConfig(this.game.config))

    canPlace = $derived(this.canAct(ActionType.PlacePiece))
    canEndPlacing = $derived(this.canAct(ActionType.EndPlacing))
    canExchange = $derived(this.canAct(ActionType.ExchangeCard))
    canPass = $derived(this.canAct(ActionType.Pass))
    canDrawFaceUp = $derived(this.canAct(ActionType.DrawFaceUp))
    canDrawFromDeck = $derived(this.canAct(ActionType.DrawFromDeck))
    isDrawing = $derived(this.canDrawFaceUp || this.canDrawFromDeck)
    canChooseCards = $derived(this.canPlace || this.canExchange)

    hand: CardColor[] = $derived(
        this.myPlayer ? (this.gameState.getPlayerState(this.myPlayer.id).hand ?? []) : []
    )

    chosenCards: CardColor[] = $derived(
        [this.ownSelection.card?.value, this.ownSelection.joker?.value].filter(
            (card): card is CardColor => card !== undefined
        )
    )

    chosenIndices: number[] = $derived.by(() => {
        const indices: number[] = []
        for (const card of this.chosenCards) {
            const index = this.hand.findIndex(
                (held, position) => held === card && !indices.includes(position)
            )
            if (index >= 0) indices.push(index)
        }
        return indices
    })

    placeableIndices: ReadonlySet<number> = $derived.by(() => {
        const playerId = this.myPlayer?.id
        if (!this.canPlace || playerId === undefined) return new Set<number>()
        const open = this.gameState.targets(playerId, this.faster)
        if (open.length === 0) return new Set<number>()
        const countries = new Set(open.map((target) => target.country))
        const indices = new Set<number>()
        this.hand.forEach((card, index) => {
            const pair = this.hand.filter((held) => held === card).length >= 2
            if (pair || CARD_COUNTRIES[card].some((country) => countries.has(country))) {
                indices.add(index)
            }
        })
        return indices
    })

    targets: PieceTarget[] = $derived.by(() => {
        const playerId = this.myPlayer?.id
        if (!this.canPlace || playerId === undefined || this.chosenCards.length === 0) return []
        const cards = this.chosenCards
        return this.gameState
            .targets(playerId, this.faster)
            .filter((target) => this.gameState.canPay(playerId, cards, target.country))
    })

    // None while a move plays, so they fade under the piece going down.
    shownTargets: PieceTarget[] = $derived(this.updatingVisibleState ? [] : this.targets)

    cloisterTargets: ReadonlySet<string> = $derived(
        new Set(
            this.shownTargets
                .filter((target) => target.kind === PieceKind.Cloister)
                .map((target) => target.abbey ?? '')
        )
    )

    advisorTargets: ReadonlySet<Country> = $derived(
        new Set(
            this.shownTargets
                .filter((target) => target.kind === PieceKind.Advisor)
                .map((target) => target.country)
        )
    )

    chosenCountries: readonly Country[] = $derived(
        this.chosenCards.length === 2
            ? Object.values(Country)
            : this.chosenCards.length === 1
              ? CARD_COUNTRIES[this.chosenCards[0]]
              : []
    )

    cardsToDraw: number = $derived.by(() => {
        const playerId = this.myPlayer?.id
        if (!this.isDrawing || playerId === undefined) return 0
        return 3 - this.gameState.getPlayerState(playerId).handCount
    })

    private canAct(type: ActionType): boolean {
        return !this.isViewingHistory && this.isMyTurn && this.validActionTypes.includes(type)
    }

    chooseCard(index: number) {
        if (this.updatingVisibleState || !this.canChooseCards) return
        const card = this.hand[index]
        if (card === undefined) return
        if (this.chosenIndices.includes(index)) {
            this.select(
                setWebOfPowerSelection(
                    this.ownSelection,
                    this.chosenCards.length === 2 ? 'joker' : 'card',
                    undefined
                )
            )
            return
        }
        const first = this.ownSelection.card?.value
        if (first === card && this.chosenCards.length === 1 && this.canPlace) {
            this.select(setWebOfPowerSelection(this.ownSelection, 'joker', card))
        } else {
            this.select(setWebOfPowerSelection({}, 'card', card))
        }
    }

    letGo() {
        if (this.updatingVisibleState || this.chosenCards.length === 0) return
        this.select({})
    }

    async placeAt(target: PieceTarget) {
        if (this.updatingVisibleState || !this.canPlace) return
        const allowed = this.targets.some(
            (candidate) =>
                candidate.kind === target.kind &&
                candidate.country === target.country &&
                candidate.abbey === target.abbey
        )
        if (!allowed) return
        await this.applyAction(
            this.createPlayerAction(PlacePiece, { cards: [...this.chosenCards], ...target })
        )
    }

    async endPlacing() {
        if (this.updatingVisibleState || !this.canEndPlacing) return
        await this.applyAction(this.createPlayerAction(EndPlacing, {}))
    }

    async exchange() {
        const [card] = this.chosenCards
        if (this.updatingVisibleState || !this.canExchange || card === undefined) return
        await this.applyAction(this.createPlayerAction(ExchangeCard, { card }))
    }

    async pass() {
        if (this.updatingVisibleState || !this.canPass) return
        await this.applyAction(this.createPlayerAction(Pass, {}))
    }

    async drawFaceUp(card: CardColor) {
        if (this.updatingVisibleState || !this.canDrawFaceUp) return
        await this.applyAction(this.createPlayerAction(DrawFaceUp, { card }))
    }

    async drawFromDeck() {
        if (this.updatingVisibleState || !this.canDrawFromDeck) return
        await this.applyAction(this.createPlayerAction(DrawFromDeck, { revealsInfo: true }))
    }

    private select(selection: WebOfPowerSelection) {
        this.selection = selection
        this.selectionOwner = this.myPlayer?.id
    }
}
