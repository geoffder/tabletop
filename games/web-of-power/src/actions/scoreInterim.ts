import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedWebOfPowerGameState } from '../model/gameState.js'
import { CountryAwards } from '../model/scoring.js'

export type ScoreInterimResult = Type.Static<typeof ScoreInterimResult>
export const ScoreInterimResult = Type.Object({
    cloisters: Type.Array(CountryAwards)
})

export type ScoreInterim = Type.Static<typeof ScoreInterim>
export const ScoreInterim = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.ScoreInterim),
            revealsInfo: Type.Literal(true),
            metadata: Type.Optional(ScoreInterimResult)
        })
    ])
)

export const ScoreInterimValidator = Compile(ScoreInterim)

export function isScoreInterim(action?: GameAction): action is ScoreInterim {
    return action?.type === ActionType.ScoreInterim
}

export class HydratedScoreInterim
    extends HydratableAction<typeof ScoreInterim>
    implements ScoreInterim
{
    declare type: ActionType.ScoreInterim
    declare revealsInfo: true
    declare metadata?: ScoreInterimResult

    constructor(data: ScoreInterim) {
        super(data, ScoreInterimValidator)
    }

    apply(state: HydratedWebOfPowerGameState) {
        const cloisters = state.cloisterAwards()
        for (const { awards } of cloisters) state.award(awards)
        state.reshuffleDiscard(state.getProtectedPrng().random)
        this.metadata = { cloisters }
    }
}
