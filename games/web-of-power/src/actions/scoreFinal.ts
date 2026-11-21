import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedWebOfPowerGameState } from '../model/gameState.js'
import { AllianceAwards, ChainAward, CountryAwards } from '../model/scoring.js'

export type ScoreFinalResult = Type.Static<typeof ScoreFinalResult>
export const ScoreFinalResult = Type.Object({
    cloisters: Type.Array(CountryAwards),
    alliances: Type.Array(AllianceAwards),
    chains: Type.Array(ChainAward)
})

export type ScoreFinal = Type.Static<typeof ScoreFinal>
export const ScoreFinal = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.ScoreFinal),
            metadata: Type.Optional(ScoreFinalResult)
        })
    ])
)

export const ScoreFinalValidator = Compile(ScoreFinal)

export function isScoreFinal(action?: GameAction): action is ScoreFinal {
    return action?.type === ActionType.ScoreFinal
}

export class HydratedScoreFinal extends HydratableAction<typeof ScoreFinal> implements ScoreFinal {
    declare type: ActionType.ScoreFinal
    declare metadata?: ScoreFinalResult

    constructor(data: ScoreFinal) {
        super(data, ScoreFinalValidator)
    }

    apply(state: HydratedWebOfPowerGameState) {
        const cloisters = state.cloisterAwards()
        const alliances = state.allianceAwards()
        const chains = state.chainAwards()
        for (const { awards } of [...cloisters, ...alliances]) state.award(awards)
        state.award(
            chains.map((chain) => ({ playerId: chain.playerId, points: chain.abbeys.length }))
        )
        state.declareResult()
        this.metadata = { cloisters, alliances, chains }
    }
}
