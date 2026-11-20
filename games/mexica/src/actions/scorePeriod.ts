import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedMexicaGameState } from '../model/gameState.js'
import { PERIODS } from '../model/pieces.js'
import { DistrictScore } from '../model/scoring.js'

export type ScorePeriodMetadata = Type.Static<typeof ScorePeriodMetadata>
export const ScorePeriodMetadata = Type.Object({
    period: Type.Integer({ minimum: 1, maximum: PERIODS }),
    districts: Type.Array(DistrictScore),
    // Players whose Pilli Mexica stood on a starting space, five points each.
    palace: Type.Array(Type.String())
})

// The end of a period: districts score by temple levels; after the first, the set-aside tokens
// and temples come into play.
export type ScorePeriod = Type.Static<typeof ScorePeriod>
export const ScorePeriod = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.ScorePeriod),
            metadata: Type.Optional(ScorePeriodMetadata)
        })
    ])
)

export const ScorePeriodValidator = Compile(ScorePeriod)

export function isScorePeriod(action?: GameAction): action is ScorePeriod {
    return action?.type === ActionType.ScorePeriod
}

export class HydratedScorePeriod
    extends HydratableAction<typeof ScorePeriod>
    implements ScorePeriod
{
    declare type: ActionType.ScorePeriod
    declare metadata?: ScorePeriodMetadata

    constructor(data: ScorePeriod) {
        super(data, ScorePeriodValidator)
    }

    apply(state: HydratedMexicaGameState) {
        const period = state.period
        const districts = state.scoreDistricts()
        const palace = state.scorePalace()
        this.metadata = { period, districts, palace }
        if (period < PERIODS) state.startSecondPeriod()
        else state.declareResult()
    }
}
