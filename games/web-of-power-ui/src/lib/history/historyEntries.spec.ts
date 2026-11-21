import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { Abbey, ActionType, CardColor, Country, PieceKind } from '@tabletop/web-of-power'
import { historyEntries, pointsByPlayer, type TurnEntry } from './historyEntries.js'
import { turnSegments } from './entryText.js'

const ALICE = 'player-1'
const BOB = 'player-2'

let next = 0
function action(type: ActionType, fields: Record<string, unknown> = {}): GameAction {
    next += 1
    return {
        id: `action-${next}`,
        gameId: 'game',
        source: fields.playerId === undefined ? ActionSource.System : ActionSource.User,
        type,
        ...fields
    }
}

const placed = (playerId: string, cards: CardColor[], abbey?: Abbey) =>
    action(ActionType.PlacePiece, {
        playerId,
        cards,
        kind: abbey ? PieceKind.Cloister : PieceKind.Advisor,
        country: abbey ? Country.England : Country.Frankreich,
        abbey
    })

function turnOf(actions: GameAction[]): TurnEntry {
    const [entry] = historyEntries(actions)
    if (entry?.kind !== 'turn') throw Error('The actions make a turn')
    return entry
}

const text = (entry: TurnEntry, brief = false) =>
    turnSegments(entry, brief)
        .map((segment) => (segment.kind === 'text' ? segment.text : `[${segment.card}]`))
        .join('')

describe('historyEntries', () => {
    it('gathers a turn, with its closing refill', () => {
        const entries = historyEntries([
            placed(ALICE, [CardColor.EnglandSchwaben], Abbey.Whitland),
            action(ActionType.DrawFaceUp, { playerId: ALICE, card: CardColor.Frankreich }),
            action(ActionType.DrawFromDeck, { playerId: ALICE, metadata: { exhausted: false } }),
            action(ActionType.RefillDisplay),
            placed(BOB, [CardColor.Frankreich])
        ])
        expect(entries.map((entry) => [entry.kind, entry.firstIndex, entry.lastIndex])).toEqual([
            ['turn', 0, 3],
            ['turn', 4, 4]
        ])
    })

    it('adds up each scoring by player, chains a point a cloister', () => {
        const [entry] = historyEntries([
            action(ActionType.ScoreFinal, {
                metadata: {
                    cloisters: [
                        {
                            country: Country.England,
                            awards: [
                                { playerId: ALICE, points: 3 },
                                { playerId: BOB, points: 1 }
                            ]
                        }
                    ],
                    alliances: [{ alliance: 2, awards: [{ playerId: BOB, points: 4 }] }],
                    chains: [
                        {
                            playerId: ALICE,
                            abbeys: [Abbey.Whitland, Abbey.Glastonbury, Abbey.Ford, Abbey.Waverley]
                        }
                    ]
                }
            })
        ])
        expect(entry.kind).toBe('final')
        if (entry.kind !== 'final') return
        expect(pointsByPlayer(entry)).toEqual([
            { playerId: ALICE, points: 7 },
            { playerId: BOB, points: 5 }
        ])
    })
})

describe('turnSegments', () => {
    const turn = () =>
        turnOf([
            placed(ALICE, [CardColor.EnglandSchwaben], Abbey.Whitland),
            placed(ALICE, [CardColor.Frankreich, CardColor.Frankreich]),
            action(ActionType.DrawFaceUp, { playerId: ALICE, card: CardColor.BayernBurgund }),
            action(ActionType.DrawFromDeck, { playerId: ALICE, metadata: { exhausted: false } })
        ])

    it('names the space, the cards paid and what was drawn, the deck card unseen', () => {
        expect(text(turn())).toBe(
            ' placed a cloister at Whitland in England with [england-schwaben] and an advisor in' +
                ' Frankreich with a joker of two [frankreich], drew [bayern-burgund] and a card from' +
                ' the deck'
        )
    })

    it('keeps the waiting line to the pieces placed', () => {
        expect(text(turn(), true)).toBe(
            ' placed a cloister in England and an advisor in Frankreich'
        )
    })

    it('tells an exchange and a pass', () => {
        const exchange = turnOf([
            action(ActionType.ExchangeCard, { playerId: BOB, card: CardColor.FrankenAragon }),
            action(ActionType.DrawFromDeck, { playerId: BOB, metadata: { exhausted: false } })
        ])
        expect(text(exchange, true)).toBe(' exchanged [franken-aragon], drew a card')
        expect(text(turnOf([action(ActionType.Pass, { playerId: BOB })]))).toBe(' passed')
    })
})
