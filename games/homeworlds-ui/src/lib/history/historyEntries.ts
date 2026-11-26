import { assertExists, isCallGameAction, type GameAction } from '@tabletop/common'
import {
    HOMEWORLD_SYSTEM_IDS,
    isBuild,
    isCapture,
    isCatastrophe,
    isCreateHomeworld,
    isDiscover,
    isEndTurn,
    isMove,
    isSacrifice,
    isTrade,
    type PyramidColor
} from '@tabletop/homeworlds'

type Span = { id: string; firstIndex: number; lastIndex: number }
type Played = Span & { playerId: string; turnEnded: boolean }

// A system named by its star, or as a homeworld by seat.
export type SystemName = { kind: 'star'; piece: number } | { kind: 'homeworld'; seat: number }

export type ActionDetail =
    | { kind: 'homeworld'; stars: number[]; ship: number }
    | { kind: 'build'; piece: number; at: SystemName }
    | { kind: 'move'; ship: number; from: SystemName; to: SystemName; abandoned: boolean }
    | { kind: 'discover'; ship: number; from: SystemName; star: number; abandoned: boolean }
    | { kind: 'capture'; ship: number; fromOwnerId: string }
    | { kind: 'trade'; ship: number; piece: number }
    | { kind: 'sacrifice'; ship: number; abandoned: boolean }
    | {
          kind: 'catastrophe'
          at: SystemName
          color: PyramidColor
          stars: number[]
          ships: number
          removed: boolean
      }
    | { kind: 'endTurn'; passed: boolean; unused: number }

export type ActionEntry = Played & ActionDetail

// A game called, conceded or ended as stalled.
export type CallEntry = Span & { kind: 'call'; action: GameAction }

export type HistoryEntry = ActionEntry | CallEntry

export function systemName(systemId: number): SystemName {
    const seat = HOMEWORLD_SYSTEM_IDS.findIndex((id) => id === systemId)
    return seat >= 0 ? { kind: 'homeworld', seat } : { kind: 'star', piece: systemId }
}

// What the action did, and whether the turn ended with it.
function detailOf(action: GameAction): [ActionDetail, boolean] | undefined {
    if (isCreateHomeworld(action)) {
        assertExists(action.metadata, 'A built homeworld records its pieces')
        return [
            {
                kind: 'homeworld',
                stars: action.metadata.starPieces,
                ship: action.metadata.shipPiece
            },
            true
        ]
    }
    if (isBuild(action)) {
        assertExists(action.metadata, 'A build records its piece')
        return [
            { kind: 'build', piece: action.metadata.piece, at: systemName(action.systemId) },
            action.metadata.turnEnded === true
        ]
    }
    if (isMove(action)) {
        assertExists(action.metadata, 'A move records where it left')
        return [
            {
                kind: 'move',
                ship: action.ship,
                from: systemName(action.metadata.fromSystemId),
                to: systemName(action.systemId),
                abandoned: action.metadata.abandonedStars.length > 0
            },
            action.metadata.turnEnded === true
        ]
    }
    if (isDiscover(action)) {
        assertExists(action.metadata, 'A discovery records its star')
        return [
            {
                kind: 'discover',
                ship: action.ship,
                from: systemName(action.metadata.fromSystemId),
                star: action.metadata.starPiece,
                abandoned: action.metadata.abandonedStars.length > 0
            },
            action.metadata.turnEnded === true
        ]
    }
    if (isCapture(action)) {
        assertExists(action.metadata, 'A capture records the former owner')
        return [
            { kind: 'capture', ship: action.ship, fromOwnerId: action.metadata.fromOwnerId },
            action.metadata.turnEnded === true
        ]
    }
    if (isTrade(action)) {
        assertExists(action.metadata, 'A trade records the new piece')
        return [
            { kind: 'trade', ship: action.ship, piece: action.metadata.piece },
            action.metadata.turnEnded === true
        ]
    }
    if (isSacrifice(action)) {
        assertExists(action.metadata, 'A sacrifice records its system')
        return [
            {
                kind: 'sacrifice',
                ship: action.ship,
                abandoned: action.metadata.abandonedStars.length > 0
            },
            action.metadata.turnEnded === true
        ]
    }
    if (isCatastrophe(action)) {
        assertExists(action.metadata, 'A catastrophe records what it destroyed')
        const { destroyed } = action.metadata
        return [
            {
                kind: 'catastrophe',
                at: systemName(action.systemId),
                color: action.color,
                stars: destroyed.stars,
                ships: destroyed.ships.length,
                removed: destroyed.systemRemoved
            },
            action.metadata.turnEnded === true
        ]
    }
    if (isEndTurn(action)) {
        assertExists(action.metadata, 'An ended turn records what was left')
        return [
            { kind: 'endTurn', passed: action.metadata.passed, unused: action.metadata.unused },
            true
        ]
    }
    return undefined
}

export function historyEntries(actions: readonly GameAction[]): HistoryEntry[] {
    return actions.flatMap((action, index): HistoryEntry[] => {
        const span = { id: action.id, firstIndex: index, lastIndex: index }
        if (isCallGameAction(action)) return [{ ...span, kind: 'call', action }]
        const described = detailOf(action)
        if (described === undefined || action.playerId === undefined) return []
        const [detail, turnEnded] = described
        return [{ ...span, ...detail, playerId: action.playerId, turnEnded }]
    })
}

// One player's turn: the actions they took, in order, until the turn ended.
export type TurnEntry = {
    id: string
    playerId: string
    firstIndex: number
    lastIndex: number
    steps: ActionEntry[]
    ended: boolean
}

export type TurnOrCall = (TurnEntry & { kind: 'turn' }) | CallEntry

export function turnEntries(entries: readonly HistoryEntry[]): TurnOrCall[] {
    const turns: TurnOrCall[] = []
    for (const entry of entries) {
        if (entry.kind === 'call') {
            turns.push(entry)
            continue
        }
        const last = turns.at(-1)
        if (last && last.kind !== 'call' && !last.ended && last.playerId === entry.playerId) {
            last.steps.push(entry)
            last.lastIndex = entry.lastIndex
            last.ended = entry.turnEnded
        } else {
            turns.push({
                kind: 'turn',
                id: entry.id,
                playerId: entry.playerId,
                firstIndex: entry.firstIndex,
                lastIndex: entry.lastIndex,
                steps: [entry],
                ended: entry.turnEnded
            })
        }
    }
    return turns
}
