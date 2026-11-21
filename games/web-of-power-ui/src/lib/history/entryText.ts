import {
    COUNTRY_NAMES,
    PieceKind,
    spaceOf,
    type CardColor,
    type Country
} from '@tabletop/web-of-power'
import type { Placed, TurnEntry } from './historyEntries.js'

export type Segment = { kind: 'text'; text: string } | { kind: 'card'; card: CardColor }

const text = (value: string): Segment => ({ kind: 'text', text: value })
const card = (value: CardColor): Segment => ({ kind: 'card', card: value })

const pieceName = (kind: PieceKind) => (kind === PieceKind.Cloister ? 'a cloister' : 'an advisor')

// Spaces live inside text segments: Svelte trims whitespace at the edges of template blocks.
export function turnSegments(entry: TurnEntry, brief = false): Segment[] {
    const parts: Segment[][] = []
    if (entry.placed.length > 0) parts.push(placedSegments(entry.placed, brief))
    if (entry.exchanged) parts.push([text('exchanged '), card(entry.exchanged)])
    if (!brief || entry.placed.length === 0) {
        const drawn = drawnSegments(entry, brief)
        if (drawn.length > 0) parts.push(drawn)
    }
    if (entry.passed) parts.push([text('passed')])
    if (parts.length === 0) parts.push([text('is placing')])
    return [
        text(' '),
        ...parts.flatMap((part, index) => (index === 0 ? part : [text(', '), ...part]))
    ]
}

function placedSegments(placed: Placed[], brief: boolean): Segment[] {
    const sameCountry = placed.every((piece) => piece.country === placed[0].country)
    if (brief && sameCountry) {
        const pieces = placed.map((piece) => pieceName(piece.kind)).join(' and ')
        return [text(`placed ${pieces} in ${COUNTRY_NAMES[placed[0].country]}`)]
    }
    return placed.flatMap((piece, index) => [
        text(index === 0 ? 'placed ' : ' and '),
        text(`${pieceName(piece.kind)} ${where(piece.kind, piece.country, piece.abbey, brief)}`),
        ...(brief ? [] : paidWith(piece.cards))
    ])
}

function where(kind: PieceKind, country: Country, abbey: Placed['abbey'], brief: boolean) {
    if (kind === PieceKind.Cloister && abbey !== undefined && !brief) {
        return `at ${spaceOf(abbey).name} in ${COUNTRY_NAMES[country]}`
    }
    return `in ${COUNTRY_NAMES[country]}`
}

function paidWith(cards: CardColor[]): Segment[] {
    return cards.length === 2
        ? [text(' with a joker of two '), card(cards[0])]
        : [text(' with '), card(cards[0])]
}

function drawnSegments(entry: TurnEntry, brief: boolean): Segment[] {
    const count = entry.faceUp.length + entry.fromDeck.length
    if (count === 0) return []
    if (brief) return [text(`drew ${count === 1 ? 'a card' : `${count} cards`}`)]
    const segments: Segment[] = [text('drew ')]
    entry.faceUp.forEach((faceUp, index) => {
        segments.push(...(index > 0 ? [text(' ')] : []), card(faceUp))
    })
    const known = entry.fromDeck.filter((drawn): drawn is CardColor => drawn !== undefined)
    const unknown = entry.fromDeck.length - known.length
    if (entry.fromDeck.length > 0) {
        segments.push(text(entry.faceUp.length > 0 ? ' and ' : ''))
        known.forEach((drawn, index) =>
            segments.push(...(index > 0 ? [text(' ')] : []), card(drawn))
        )
        if (unknown > 0) {
            segments.push(
                text(
                    `${known.length > 0 ? ' and ' : ''}${unknown === 1 ? 'a card' : `${unknown} cards`}`
                )
            )
        }
        segments.push(text(' from the deck'))
    }
    return segments
}
