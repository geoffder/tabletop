import * as Type from 'typebox'
import { CellSchema } from './board.js'
import { DistrictTokenSchema } from './pieces.js'

export type Award = Type.Static<typeof Award>
export const Award = Type.Object({
    playerId: Type.String(),
    place: Type.Integer({ minimum: 1, maximum: 3 }),
    levels: Type.Integer({ minimum: 1 }),
    points: Type.Integer({ minimum: 1 })
})

export type DistrictScore = Type.Static<typeof DistrictScore>
export const DistrictScore = Type.Object({
    // The founded district's token; an unfounded district has none.
    tokenId: Type.Optional(DistrictTokenSchema),
    // The district's first cell, to name it in history.
    cell: CellSchema,
    size: Type.Integer({ minimum: 1 }),
    awards: Type.Array(Award)
})

export const NEUTRAL = 'neutral'

// Places by temple levels: tied players share a place and each scores it in full, and the places
// they fill are skipped. Nobody without a level places. The neutral temples of a two-player game
// take places but score nothing.
export function rankAwards(
    levels: ReadonlyMap<string, number>,
    points: readonly [number, number, number]
): Award[] {
    const standing = [...levels.entries()]
        .filter(([, count]) => count > 0)
        .sort((a, b) => b[1] - a[1])
    const awards: Award[] = []
    for (const [playerId, count] of standing) {
        const place = standing.findIndex(([, other]) => other === count) + 1
        if (place > 3) break
        if (playerId !== NEUTRAL && points[place - 1] > 0) {
            awards.push({ playerId, place, levels: count, points: points[place - 1] })
        }
    }
    return awards
}
