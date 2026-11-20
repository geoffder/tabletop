import {
    assertExists,
    DrawBag,
    GameResult,
    GameState,
    HydratableGameState,
    HydratedDrawBag,
    HydratedTurnManager,
    PrngState,
    shuffle,
    Visibility,
    type RandomFunction
} from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { MachineState } from '../definition/states.js'
import {
    Abbey,
    AbbeySchema,
    ALLIANCES,
    CARD_COUNTRIES,
    CardColor,
    CardColorSchema,
    Country,
    CountrySchema,
    SCORING_ORDER,
    SPACES,
    spaceOf
} from './map.js'
import {
    WebOfPowerPlayerState,
    HydratedWebOfPowerPlayerState,
    WebOfPowerProjectedPlayerState
} from './playerState.js'
import {
    advisorLeaders,
    cloisterAwards,
    longestChains,
    type AllianceAwards,
    type Award,
    type ChainAward,
    type CountryAwards
} from './scoring.js'

export const CLOISTERS_PER_PLAYER = 20
export const ADVISORS_PER_PLAYER = 8
export const DISPLAY_SIZE = 2
// The deck runs out twice: the first time brings the interim scoring, the second the last round.
export const DECK_PASSES = 2

export enum PieceKind {
    Cloister = 'cloister',
    Advisor = 'advisor'
}

export type Cloister = Type.Static<typeof Cloister>
export const Cloister = Type.Object({
    abbey: AbbeySchema,
    playerId: Type.String()
})

export type Advisor = Type.Static<typeof Advisor>
export const Advisor = Type.Object({
    country: CountrySchema,
    playerId: Type.String()
})

// A piece placed this turn, which decides what else may go down before the turn ends.
export type Placement = Type.Static<typeof Placement>
export const Placement = Type.Object({
    country: CountrySchema,
    kind: Type.Enum(PieceKind),
    // The country held no cloister before this piece.
    opened: Type.Boolean()
})

export type WebOfPowerGameState = Type.Static<typeof WebOfPowerGameState>
export const WebOfPowerGameState = Type.Object({
    ...Type.Omit(GameState, ['players', 'machineState']).properties,
    players: Type.Array(WebOfPowerPlayerState),
    machineState: Type.Enum(MachineState),
    cloisters: Type.Array(Cloister, { maxItems: SPACES.length }),
    advisors: Type.Array(Advisor),
    deck: DrawBag(CardColorSchema),
    display: Type.Array(CardColorSchema, { maxItems: DISPLAY_SIZE }),
    // Played and exchanged cards, the latest last. Every card in it was shown when it went there.
    discard: Type.Array(CardColorSchema),
    deckExhaustions: Type.Integer({ minimum: 0, maximum: DECK_PASSES }),
    placements: Type.Array(Placement, { maxItems: 2 })
})

export const WebOfPowerGameStateValidator = Compile(WebOfPowerGameState)

export const WebOfPowerProjectedState = Visibility.createProjectionSchema(WebOfPowerGameState)
export type WebOfPowerProjectedState = Type.Static<typeof WebOfPowerProjectedState>
const WebOfPowerProjectedStateValidator = Compile(WebOfPowerProjectedState)

const ProjectedDeck = Visibility.createProjectionSchema(DrawBag(CardColorSchema))
const ProjectedDeckValidator = Compile(ProjectedDeck)

export class HydratedDeck extends HydratedDrawBag<CardColor, typeof ProjectedDeck> {
    constructor(data: Type.Static<typeof ProjectedDeck>) {
        super(data, ProjectedDeckValidator)
    }
}

// What a placement covers: the piece and where it goes. Cards pay for it separately.
export interface PieceTarget {
    kind: PieceKind
    country: Country
    abbey?: Abbey
}

export class HydratedWebOfPowerGameState
    extends HydratableGameState<typeof WebOfPowerProjectedState, HydratedWebOfPowerPlayerState>
    implements WebOfPowerProjectedState
{
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedWebOfPowerPlayerState[]
    declare turnManager: HydratedTurnManager
    declare machineState: MachineState
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare cloisters: Cloister[]
    declare advisors: Advisor[]
    declare deck: HydratedDeck
    declare display: CardColor[]
    declare discard: CardColor[]
    declare deckExhaustions: number
    declare placements: Placement[]

    constructor(data: WebOfPowerProjectedState) {
        super(data, WebOfPowerProjectedStateValidator)
        this.players = data.players.map(
            (player: WebOfPowerProjectedPlayerState) => new HydratedWebOfPowerPlayerState(player)
        )
        this.deck = new HydratedDeck(data.deck)
    }

    // The board

    cloisterAt(abbey: Abbey): Cloister | undefined {
        return this.cloisters.find((cloister) => cloister.abbey === abbey)
    }

    cloistersIn(country: Country): Cloister[] {
        return this.cloisters.filter((cloister) => spaceOf(cloister.abbey).country === country)
    }

    advisorsIn(country: Country): Advisor[] {
        return this.advisors.filter((advisor) => advisor.country === country)
    }

    cloisterCounts(country: Country): Map<string, number> {
        return countBy(this.cloistersIn(country))
    }

    advisorCounts(country: Country): Map<string, number> {
        return countBy(this.advisorsIn(country))
    }

    // Advisors in a country may not outnumber the cloisters of whoever has the most there.
    advisorLimit(country: Country): number {
        return Math.max(0, ...this.cloisterCounts(country).values())
    }

    cloistersLeft(playerId: string): number {
        return (
            CLOISTERS_PER_PLAYER -
            this.cloisters.filter((cloister) => cloister.playerId === playerId).length
        )
    }

    advisorsLeft(playerId: string): number {
        return (
            ADVISORS_PER_PLAYER -
            this.advisors.filter((advisor) => advisor.playerId === playerId).length
        )
    }

    piecesLeft(playerId: string): number {
        return this.cloistersLeft(playerId) + this.advisorsLeft(playerId)
    }

    // Placing

    // Whether the piece may go there now, given what the player placed earlier this turn. Cards are
    // checked separately.
    canPlace(playerId: string, target: PieceTarget, faster: boolean): boolean {
        if (this.placements.length >= 2) return false
        const earlier = this.placements[0]
        if (earlier !== undefined && earlier.country === target.country) {
            // A player who opens a country places nothing more there that turn; in the variant only
            // a second cloister.
            if (earlier.opened && (!faster || target.kind !== PieceKind.Cloister)) return false
        } else if (earlier !== undefined && !faster) {
            return false
        }
        if (target.kind === PieceKind.Cloister) {
            return (
                target.abbey !== undefined &&
                spaceOf(target.abbey).country === target.country &&
                this.cloisterAt(target.abbey) === undefined &&
                this.cloistersLeft(playerId) > 0
            )
        }
        return (
            target.abbey === undefined &&
            this.advisorsLeft(playerId) > 0 &&
            this.advisorsIn(target.country).length < this.advisorLimit(target.country)
        )
    }

    // One card naming the country, or two cards of one colour as a joker for any country.
    canPay(playerId: string, cards: readonly CardColor[], country: Country): boolean {
        if (!this.getPlayerState(playerId).holds(cards)) return false
        if (cards.length === 1) return CARD_COUNTRIES[cards[0]].includes(country)
        return cards.length === 2 && cards[0] === cards[1]
    }

    // Every way the player could pay for a piece in the country from their hand.
    payments(playerId: string, country: Country): CardColor[][] {
        const hand = this.getPlayerState(playerId).knownHand()
        const colors = [...new Set(hand)]
        return [
            ...colors.filter((color) => CARD_COUNTRIES[color].includes(country)).map((c) => [c]),
            ...colors
                .filter((color) => hand.filter((c) => c === color).length >= 2)
                .map((c) => [c, c])
        ]
    }

    // Every piece and place the rules allow the player now, before cards.
    targets(playerId: string, faster: boolean): PieceTarget[] {
        const targets: PieceTarget[] = []
        for (const country of SCORING_ORDER) {
            for (const space of SPACES) {
                if (space.country !== country) continue
                const target = { kind: PieceKind.Cloister, country, abbey: space.abbey }
                if (this.canPlace(playerId, target, faster)) targets.push(target)
            }
            const advisor = { kind: PieceKind.Advisor, country }
            if (this.canPlace(playerId, advisor, faster)) targets.push(advisor)
        }
        return targets
    }

    canPlaceAnything(playerId: string, faster: boolean): boolean {
        return this.targets(playerId, faster).some(
            (target) => this.payments(playerId, target.country).length > 0
        )
    }

    // Whether anyone could still put a piece on the board, cards aside. When nobody can, the game
    // ends.
    anyPieceCanGoDown(): boolean {
        const freeSpace = this.cloisters.length < SPACES.length
        return this.players.some(
            (player) =>
                (freeSpace && this.cloistersLeft(player.playerId) > 0) ||
                (this.advisorsLeft(player.playerId) > 0 &&
                    SCORING_ORDER.some(
                        (country) => this.advisorsIn(country).length < this.advisorLimit(country)
                    ))
        )
    }

    placePiece(playerId: string, cards: readonly CardColor[], target: PieceTarget) {
        const opened = this.cloistersIn(target.country).length === 0
        this.getPlayerState(playerId).giveUp(cards)
        this.discard.push(...cards)
        if (target.kind === PieceKind.Cloister) {
            assertExists(target.abbey, 'A cloister goes on an abbey')
            this.cloisters.push({ abbey: target.abbey, playerId })
        } else {
            this.advisors.push({ country: target.country, playerId })
        }
        this.placements.push({ country: target.country, kind: target.kind, opened })
    }

    exchange(playerId: string, card: CardColor) {
        this.getPlayerState(playerId).giveUp([card])
        this.discard.push(card)
    }

    // Cards

    isFinalRound(): boolean {
        return this.deckExhaustions >= DECK_PASSES
    }

    canDraw(): boolean {
        return !this.isFinalRound() && (this.display.length > 0 || !this.deck.isEmpty())
    }

    // Takes the top card of the deck. Returns true when that was its last card.
    drawFromDeck(): { card: CardColor; exhausted: boolean } {
        const card = this.deck.draw()
        const exhausted = this.deck.isEmpty()
        if (exhausted) this.deckExhaustions += 1
        return { card, exhausted }
    }

    takeFaceUp(card: CardColor) {
        const index = this.display.indexOf(card)
        if (index < 0) throw Error(`No face-up ${card} card`)
        this.display.splice(index, 1)
    }

    // Fills the face-up row from the deck, stopping if the deck runs out.
    refillDisplay(): { cards: CardColor[]; exhausted: boolean } {
        const cards: CardColor[] = []
        let exhausted = false
        while (this.display.length < DISPLAY_SIZE && !this.deck.isEmpty() && !exhausted) {
            const drawn = this.drawFromDeck()
            this.display.push(drawn.card)
            cards.push(drawn.card)
            exhausted = drawn.exhausted
        }
        return { cards, exhausted }
    }

    displayNeedsCards(): boolean {
        return this.display.length < DISPLAY_SIZE && !this.deck.isEmpty()
    }

    // The discard pile becomes the new deck; face-up cards stay where they are.
    reshuffleDiscard(random: RandomFunction) {
        this.deck.items = [...this.discard]
        this.deck.remaining = this.discard.length
        shuffle(this.deck.items, random)
        this.discard = []
    }

    // Scoring

    cloisterAwards(): CountryAwards[] {
        return SCORING_ORDER.map((country) => ({
            country,
            awards: cloisterAwards(this.cloisterCounts(country))
        })).filter((entry) => entry.awards.length > 0)
    }

    // An alliance scores for a player with the most advisors, or a share of the most, in both its
    // countries: one point for every advisor in the two countries.
    allianceAwards(): AllianceAwards[] {
        return ALLIANCES.map(([a, b], index) => {
            const leadersA = advisorLeaders(this.advisorCounts(a))
            const leadersB = advisorLeaders(this.advisorCounts(b))
            const points = this.advisorsIn(a).length + this.advisorsIn(b).length
            const awards: Award[] = this.players
                .filter(
                    (player) =>
                        leadersA.includes(player.playerId) && leadersB.includes(player.playerId)
                )
                .map((player) => ({ playerId: player.playerId, points }))
            return { alliance: index + 1, awards }
        }).filter((entry) => entry.awards.length > 0)
    }

    chainAwards(): ChainAward[] {
        return this.players.flatMap((player) =>
            longestChains(
                new Set(
                    this.cloisters
                        .filter((cloister) => cloister.playerId === player.playerId)
                        .map((cloister) => cloister.abbey)
                )
            ).map((abbeys) => ({ playerId: player.playerId, abbeys }))
        )
    }

    award(awards: readonly Award[]) {
        for (const { playerId, points } of awards) {
            this.getPlayerState(playerId).score += points
        }
    }

    // Most points wins; a tie goes to whoever has the most pieces left, and a tie in that too is
    // shared.
    declareResult() {
        const best = Math.max(...this.players.map((player) => player.score))
        const leaders = this.players.filter((player) => player.score === best)
        const mostLeft = Math.max(...leaders.map((player) => this.piecesLeft(player.playerId)))
        this.winningPlayerIds = leaders
            .filter((player) => this.piecesLeft(player.playerId) === mostLeft)
            .map((player) => player.playerId)
        this.result = this.winningPlayerIds.length > 1 ? GameResult.Draw : GameResult.Win
        this.activePlayerIds = []
        this.placements = []
    }
}

function countBy(pieces: readonly { playerId: string }[]): Map<string, number> {
    const counts = new Map<string, number>()
    for (const { playerId } of pieces) counts.set(playerId, (counts.get(playerId) ?? 0) + 1)
    return counts
}
