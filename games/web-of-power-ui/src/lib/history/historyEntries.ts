import { isCallGameAction, type GameAction } from '@tabletop/common'
import {
    isDrawFaceUp,
    isDrawFromDeck,
    isEndPlacing,
    isExchangeCard,
    isPass,
    isPlacePiece,
    isRefillDisplay,
    isScoreFinal,
    isScoreInterim,
    type Abbey,
    type AllianceAwards,
    type CardColor,
    type ChainAward,
    type Country,
    type CountryAwards,
    type PieceKind
} from '@tabletop/web-of-power'

type Span = { id: string; firstIndex: number; lastIndex: number }

export type Placed = { kind: PieceKind; country: Country; abbey?: Abbey; cards: CardColor[] }

// One player's turn: what they placed or exchanged, what they drew, or that they passed.
export type TurnEntry = Span & {
    kind: 'turn'
    playerId: string
    placed: Placed[]
    exchanged?: CardColor
    faceUp: CardColor[]
    // Cards from the deck; a card is known only to the player who drew it.
    fromDeck: (CardColor | undefined)[]
    passed: boolean
}

export type InterimEntry = Span & { kind: 'interim'; cloisters: CountryAwards[] }

export type FinalEntry = Span & {
    kind: 'final'
    cloisters: CountryAwards[]
    alliances: AllianceAwards[]
    chains: ChainAward[]
}

// A game called, conceded or ended as stalled.
export type CallEntry = Span & { kind: 'call'; action: GameAction }

export type HistoryEntry = TurnEntry | InterimEntry | FinalEntry | CallEntry

export function historyEntries(actions: readonly GameAction[]): HistoryEntry[] {
    const entries: HistoryEntry[] = []
    const turnFor = (action: GameAction, index: number, playerId: string): TurnEntry => {
        const last = entries.at(-1)
        if (last?.kind === 'turn' && last.playerId === playerId) {
            last.lastIndex = index
            return last
        }
        const turn: TurnEntry = {
            id: action.id,
            kind: 'turn',
            firstIndex: index,
            lastIndex: index,
            playerId,
            placed: [],
            faceUp: [],
            fromDeck: [],
            passed: false
        }
        entries.push(turn)
        return turn
    }
    actions.forEach((action, index) => {
        const span = { id: action.id, firstIndex: index, lastIndex: index }
        if (isPlacePiece(action)) {
            turnFor(action, index, action.playerId).placed.push({
                kind: action.kind,
                country: action.country,
                abbey: action.abbey,
                cards: action.cards
            })
        } else if (isExchangeCard(action)) {
            turnFor(action, index, action.playerId).exchanged = action.card
        } else if (isDrawFaceUp(action)) {
            turnFor(action, index, action.playerId).faceUp.push(action.card)
        } else if (isDrawFromDeck(action)) {
            turnFor(action, index, action.playerId).fromDeck.push(action.metadata?.card)
        } else if (isPass(action)) {
            turnFor(action, index, action.playerId).passed = true
        } else if (isEndPlacing(action)) {
            turnFor(action, index, action.playerId)
        } else if (isRefillDisplay(action)) {
            // Replacing the face-up cards ends the turn it follows.
            const last = entries.at(-1)
            if (last?.kind === 'turn') last.lastIndex = index
        } else if (isScoreInterim(action)) {
            entries.push({ ...span, kind: 'interim', cloisters: action.metadata?.cloisters ?? [] })
        } else if (isScoreFinal(action)) {
            const metadata = action.metadata
            entries.push({
                ...span,
                kind: 'final',
                cloisters: metadata?.cloisters ?? [],
                alliances: metadata?.alliances ?? [],
                chains: metadata?.chains ?? []
            })
        } else if (isCallGameAction(action)) {
            entries.push({ ...span, kind: 'call', action })
        }
    })
    return entries
}

// Each player's points from a scoring, in seat order of first appearance.
export function pointsByPlayer(
    entry: InterimEntry | FinalEntry
): { playerId: string; points: number }[] {
    const totals = new Map<string, number>()
    const add = (playerId: string, points: number) =>
        totals.set(playerId, (totals.get(playerId) ?? 0) + points)
    for (const { awards } of entry.cloisters) for (const a of awards) add(a.playerId, a.points)
    if (entry.kind === 'final') {
        for (const { awards } of entry.alliances) for (const a of awards) add(a.playerId, a.points)
        for (const chain of entry.chains) add(chain.playerId, chain.abbeys.length)
    }
    return [...totals.entries()]
        .map(([playerId, points]) => ({ playerId, points }))
        .sort((a, b) => b.points - a.points)
}
