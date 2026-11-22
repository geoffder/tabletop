import type { GameAction } from '@tabletop/common'
import { isFoundDistrict, isScorePeriod, PALACE_BONUS } from '@tabletop/mexica'

// Where a player's points came from over the game: foundings, the districts scored at each
// period's end (the final one split into founded and unfounded districts), and the palace bonus.
export type ScoreSources = {
    founding: number
    firstPeriod: number
    finalFounded: number
    finalUnfounded: number
    palace: number
}

export const SOURCES: readonly (keyof ScoreSources)[] = [
    'founding',
    'firstPeriod',
    'finalFounded',
    'finalUnfounded',
    'palace'
]

export function scoreBreakdown(
    actions: readonly GameAction[],
    playerIds: readonly string[]
): Map<string, ScoreSources> {
    const sources = new Map(
        playerIds.map((playerId) => [
            playerId,
            { founding: 0, firstPeriod: 0, finalFounded: 0, finalUnfounded: 0, palace: 0 }
        ])
    )
    const add = (playerId: string, source: keyof ScoreSources, points: number) => {
        const player = sources.get(playerId)
        if (player !== undefined) player[source] += points
    }
    for (const action of actions) {
        if (isFoundDistrict(action) && action.metadata !== undefined) {
            add(action.playerId, 'founding', action.metadata.points)
            for (const visitor of action.metadata.visitors) {
                add(visitor.playerId, 'founding', visitor.points)
            }
        } else if (isScorePeriod(action) && action.metadata !== undefined) {
            const final = action.metadata.period > 1
            for (const district of action.metadata.districts) {
                const source = !final
                    ? 'firstPeriod'
                    : district.tokenId === undefined
                      ? 'finalUnfounded'
                      : 'finalFounded'
                for (const award of district.awards) add(award.playerId, source, award.points)
            }
            for (const playerId of action.metadata.palace) add(playerId, 'palace', PALACE_BONUS)
        }
    }
    return sources
}

export function totalOf(sources: ScoreSources): number {
    return SOURCES.reduce((sum, source) => sum + sources[source], 0)
}
