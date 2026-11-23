import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { ActionType, cellAt, type MovePilli, type TakeToken } from '@tabletop/mexica'
import { historyEntries } from './historyEntries.js'

let counter = 0
const base = () => {
    counter += 1
    return { id: `a${counter}`, gameId: 'g', source: ActionSource.User, playerId: 'p1' }
}
const move = (column: number, cost: number, teleport = false): MovePilli => ({
    ...base(),
    type: ActionType.MovePilli,
    to: cellAt(column, 0) ?? 0,
    metadata: { tokensSpent: 0, cost, teleport, path: [0, 1] }
})
const token = (): TakeToken => ({ ...base(), type: ActionType.TakeToken })

const steps = (actions: GameAction[]) => {
    const [entry] = historyEntries(actions)
    return entry?.kind === 'turn' ? entry.steps : []
}

describe('a turn in history', () => {
    it('makes moves one after another one move, to where the last ended, at their whole cost', () => {
        expect(steps([move(1, 1), move(2, 2), move(3, 1)])).toEqual([
            { kind: 'move', to: cellAt(3, 0), cost: 4, teleport: false }
        ])
    })

    it('calls the move a teleport only if every leg was one', () => {
        expect(steps([move(1, 5, true), move(2, 5, true)])).toEqual([
            { kind: 'move', to: cellAt(2, 0), cost: 10, teleport: true }
        ])
        expect(steps([move(1, 1), move(2, 5, true)])).toEqual([
            { kind: 'move', to: cellAt(2, 0), cost: 6, teleport: false }
        ])
    })

    it('keeps moves apart when another action comes between them', () => {
        expect(steps([move(1, 1), token(), move(2, 1)]).map((step) => step.kind)).toEqual([
            'move',
            'token',
            'move'
        ])
    })
})
