import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { ActionType, HOMEWORLD_SYSTEM_IDS, PyramidColor } from '@tabletop/homeworlds'
import { historyEntries, turnEntries } from './historyEntries.js'

let counter = 0
function action(playerId: string, fields: { type: string } & Record<string, unknown>): GameAction {
    counter += 1
    return { id: `a${counter}`, gameId: 'g', source: ActionSource.User, playerId, ...fields }
}

describe('historyEntries', () => {
    it('reads actions from their metadata and groups them by turn', () => {
        const entries = historyEntries([
            action('a', {
                type: ActionType.Sacrifice,
                ship: 20,
                metadata: { systemId: HOMEWORLD_SYSTEM_IDS[0], abandonedStars: [] }
            }),
            action('a', {
                type: ActionType.Build,
                systemId: HOMEWORLD_SYSTEM_IDS[0],
                color: PyramidColor.Green,
                metadata: { piece: 18, turnEnded: true }
            }),
            action('b', { type: ActionType.EndTurn, metadata: { passed: true, unused: 0 } })
        ])
        expect(entries).toMatchObject([
            { kind: 'sacrifice', playerId: 'a', ship: 20, turnEnded: false },
            { kind: 'build', playerId: 'a', piece: 18, at: { kind: 'homeworld', seat: 0 } },
            { kind: 'endTurn', playerId: 'b', passed: true }
        ])
        const turns = turnEntries(entries)
        expect(turns).toHaveLength(2)
        expect(turns[0]).toMatchObject({ kind: 'turn', playerId: 'a', firstIndex: 0, lastIndex: 1 })
    })
})
