import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { ActionType } from '@tabletop/mexica'
import { scoreBreakdown, totalOf } from './scoreBreakdown.js'

const base = { id: 'a', gameId: 'g', source: ActionSource.User }

const founding = (playerId: string, points: number, visitors: [string, number][] = []) => ({
    ...base,
    type: ActionType.FoundDistrict,
    playerId,
    cell: 0,
    metadata: {
        tokenId: 0,
        points,
        visitors: visitors.map(([visitor, gained]) => ({ playerId: visitor, points: gained }))
    }
})

const scoring = (
    period: number,
    districts: { tokenId?: number; awards: [string, number][] }[],
    palace: string[] = []
) => ({
    ...base,
    source: ActionSource.System,
    type: ActionType.ScorePeriod,
    metadata: {
        period,
        districts: districts.map((district) => ({
            ...(district.tokenId === undefined ? {} : { tokenId: district.tokenId }),
            cell: 0,
            size: 4,
            awards: district.awards.map(([playerId, points], index) => ({
                playerId,
                place: index + 1,
                levels: 1,
                points
            }))
        })),
        palace
    }
})

describe("where a player's points came from", () => {
    const actions: GameAction[] = [
        founding('a', 2, [['b', 1]]),
        scoring(
            1,
            [
                {
                    tokenId: 1,
                    awards: [
                        ['a', 6],
                        ['b', 3]
                    ]
                }
            ],
            ['b']
        ),
        founding('b', 3),
        scoring(
            2,
            [
                { tokenId: 1, awards: [['a', 6]] },
                {
                    awards: [
                        ['b', 9],
                        ['a', 5]
                    ]
                }
            ],
            ['a']
        )
    ]
    const breakdown = scoreBreakdown(actions, ['a', 'b'])

    it('counts foundings for the founder and its visitors', () => {
        expect(breakdown.get('a')?.founding).toBe(2)
        expect(breakdown.get('b')?.founding).toBe(4)
    })

    it('splits the periods, and the final one into founded and unfounded districts', () => {
        expect(breakdown.get('a')).toMatchObject({
            firstPeriod: 6,
            finalFounded: 6,
            finalUnfounded: 5
        })
        expect(breakdown.get('b')).toMatchObject({
            firstPeriod: 3,
            finalFounded: 0,
            finalUnfounded: 9
        })
    })

    it('adds the palace bonus each period a player earns it', () => {
        expect(breakdown.get('a')?.palace).toBe(5)
        expect(breakdown.get('b')?.palace).toBe(5)
        const a = breakdown.get('a')
        expect(a && totalOf(a)).toBe(24)
    })
})
