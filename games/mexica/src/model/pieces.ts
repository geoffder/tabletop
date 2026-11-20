import * as Type from 'typebox'
import { CellSchema, AxisSchema } from './board.js'

export const BASE_AP = 6
export const TELEPORT_COST = 5
export const ACTION_TOKEN_COUNT = 12
export const TOKENS_TAKEN_PER_TURN = 2
export const BRIDGE_COUNT = 11
export const SINGLE_CANAL_COUNT = 6
export const DOUBLE_CANAL_COUNT = 37
export const PALACE_BONUS = 5
export const FIRST_PERIOD_DISTRICTS = 8
export const PERIODS = 2

export const LEVELS = [1, 2, 3, 4] as const
export type Level = (typeof LEVELS)[number]
export const LevelSchema = Type.Union([
    Type.Literal(1),
    Type.Literal(2),
    Type.Literal(3),
    Type.Literal(4)
])

// Temples of each level a player may have built by the end of each period: nine for the first,
// all eighteen for the second.
const TEMPLES_BY_PERIOD: Record<number, Record<Level, number>> = {
    1: { 1: 3, 2: 3, 3: 2, 4: 1 },
    2: { 1: 6, 2: 5, 3: 4, 4: 3 }
}

export function templesAllowed(period: number, level: Level): number {
    return TEMPLES_BY_PERIOD[period][level]
}

// Peter Steinert's two-player rule: ten neutral temples, twenty levels in all.
export const NEUTRAL_LEVELS: readonly Level[] = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1]
export const NEUTRAL_SPACING = 5

// The fifteen calpulli tokens, by id. Each scores its size for first place, half of that rounded
// up for second, and half of second rounded up for third.
export const DISTRICT_SIZES: readonly number[] = [3, 3, 4, 4, 5, 5, 6, 6, 7, 8, 9, 10, 11, 12, 13]
export const DistrictTokenSchema = Type.Integer({ minimum: 0, maximum: DISTRICT_SIZES.length - 1 })

export function placePoints(size: number): [number, number, number] {
    const second = Math.ceil(size / 2)
    return [size, second, Math.ceil(second / 2)]
}

export function tokenSize(tokenId: number): number {
    return DISTRICT_SIZES[tokenId]
}

export type CanalTile = Type.Static<typeof CanalTile>
export const CanalTile = Type.Object({
    cells: Type.Array(CellSchema, { minItems: 1, maxItems: 2 })
})

export type Bridge = Type.Static<typeof Bridge>
export const Bridge = Type.Object({
    cell: CellSchema,
    axis: AxisSchema
})

export type Temple = Type.Static<typeof Temple>
export const Temple = Type.Object({
    cell: CellSchema,
    level: LevelSchema,
    // Absent for the neutral temples of a two-player game.
    playerId: Type.Optional(Type.String())
})

export type District = Type.Static<typeof District>
export const District = Type.Object({
    tokenId: DistrictTokenSchema,
    cell: CellSchema
})
