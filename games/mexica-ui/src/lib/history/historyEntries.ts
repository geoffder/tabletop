import { isCallGameAction, type GameAction } from '@tabletop/common'
import {
    type Axis,
    type Cell,
    type DistrictScore,
    isBuildBridge,
    isBuildTemple,
    isChooseStart,
    isDigCanal,
    isEndTurn,
    isFoundDistrict,
    isMoveBridge,
    isMovePilli,
    isRemoveTokens,
    isScorePeriod,
    isTakeToken,
    type Level
} from '@tabletop/mexica'

type Span = { id: string; firstIndex: number; lastIndex: number }

export type Step =
    | { kind: 'start'; cell: Cell }
    | { kind: 'move'; to: Cell; cost: number; teleport: boolean }
    | { kind: 'canal'; cells: Cell[] }
    | { kind: 'bridge'; cell: Cell; axis: Axis }
    | { kind: 'moveBridge'; from: Cell; to: Cell }
    | { kind: 'temple'; cell: Cell; level: Level }
    | {
          kind: 'found'
          tokenId: number
          cell: Cell
          points: number
          visitors: { playerId: string; points: number }[]
      }
    | { kind: 'token' }

// One player's turn, growing as they act, until they end it.
export type TurnEntry = Span & {
    kind: 'turn'
    playerId: string
    steps: Step[]
    ended: boolean
}

export type WithdrawnEntry = Span & { kind: 'withdrawn'; tokenIds: number[] }

export type ScoringEntry = Span & {
    kind: 'scoring'
    period: number
    districts: DistrictScore[]
    palace: string[]
}

// A game called, conceded or ended as stalled.
export type CallEntry = Span & { kind: 'call'; action: GameAction }

export type HistoryEntry = TurnEntry | WithdrawnEntry | ScoringEntry | CallEntry

export function historyEntries(actions: readonly GameAction[]): HistoryEntry[] {
    const entries: HistoryEntry[] = []
    const turnFor = (action: GameAction, index: number, playerId: string): TurnEntry => {
        const last = entries.at(-1)
        if (last?.kind === 'turn' && last.playerId === playerId && !last.ended) {
            last.lastIndex = index
            return last
        }
        const turn: TurnEntry = {
            id: action.id,
            kind: 'turn',
            firstIndex: index,
            lastIndex: index,
            playerId,
            steps: [],
            ended: false
        }
        entries.push(turn)
        return turn
    }
    actions.forEach((action, index) => {
        const span = { id: action.id, firstIndex: index, lastIndex: index }
        if (isChooseStart(action)) {
            const turn = turnFor(action, index, action.playerId)
            turn.steps.push({ kind: 'start', cell: action.cell })
            turn.ended = true
        } else if (isMovePilli(action)) {
            turnFor(action, index, action.playerId).steps.push({
                kind: 'move',
                to: action.to,
                cost: action.metadata?.cost ?? 0,
                teleport: action.metadata?.teleport ?? false
            })
        } else if (isDigCanal(action)) {
            turnFor(action, index, action.playerId).steps.push({
                kind: 'canal',
                cells: action.cells
            })
        } else if (isBuildBridge(action)) {
            turnFor(action, index, action.playerId).steps.push({
                kind: 'bridge',
                cell: action.cell,
                axis: action.axis
            })
        } else if (isMoveBridge(action)) {
            turnFor(action, index, action.playerId).steps.push({
                kind: 'moveBridge',
                from: action.metadata?.from.cell ?? action.cell,
                to: action.cell
            })
        } else if (isBuildTemple(action)) {
            turnFor(action, index, action.playerId).steps.push({
                kind: 'temple',
                cell: action.cell,
                level: action.level
            })
        } else if (isFoundDistrict(action)) {
            const metadata = action.metadata
            if (metadata === undefined) return
            turnFor(action, index, action.playerId).steps.push({
                kind: 'found',
                tokenId: metadata.tokenId,
                cell: action.cell,
                points: metadata.points,
                visitors: metadata.visitors
            })
        } else if (isTakeToken(action)) {
            turnFor(action, index, action.playerId).steps.push({ kind: 'token' })
        } else if (isEndTurn(action)) {
            turnFor(action, index, action.playerId).ended = true
        } else if (isRemoveTokens(action)) {
            entries.push({ ...span, kind: 'withdrawn', tokenIds: action.metadata?.tokenIds ?? [] })
        } else if (isScorePeriod(action)) {
            const metadata = action.metadata
            if (metadata === undefined) return
            entries.push({ ...span, kind: 'scoring', ...metadata })
        } else if (isCallGameAction(action)) {
            entries.push({ ...span, kind: 'call', action })
        }
    })
    return entries
}

// Each player's points from a scoring, most first.
export function pointsByPlayer(entry: ScoringEntry): { playerId: string; points: number }[] {
    const totals = new Map<string, number>()
    const add = (playerId: string, points: number) =>
        totals.set(playerId, (totals.get(playerId) ?? 0) + points)
    for (const district of entry.districts) {
        for (const award of district.awards) add(award.playerId, award.points)
    }
    for (const playerId of entry.palace) add(playerId, 5)
    return [...totals.entries()]
        .map(([playerId, points]) => ({ playerId, points }))
        .sort((a, b) => b.points - a.points)
}
