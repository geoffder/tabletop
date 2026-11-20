import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedWebOfPowerGameState } from '../model/gameState.js'
import { CardColorSchema } from '../model/map.js'

export type RefillDisplayResult = Type.Static<typeof RefillDisplayResult>
export const RefillDisplayResult = Type.Object({
    cards: Type.Array(CardColorSchema),
    exhausted: Type.Boolean()
})

// After a player has drawn, cards from the deck replace the face-up cards they took.
export type RefillDisplay = Type.Static<typeof RefillDisplay>
export const RefillDisplay = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.RefillDisplay),
            revealsInfo: Type.Literal(true),
            metadata: Type.Optional(RefillDisplayResult)
        })
    ])
)

export const RefillDisplayValidator = Compile(RefillDisplay)

export function isRefillDisplay(action?: GameAction): action is RefillDisplay {
    return action?.type === ActionType.RefillDisplay
}

export class HydratedRefillDisplay
    extends HydratableAction<typeof RefillDisplay>
    implements RefillDisplay
{
    declare type: ActionType.RefillDisplay
    declare revealsInfo: true
    declare metadata?: RefillDisplayResult

    constructor(data: RefillDisplay) {
        super(data, RefillDisplayValidator)
    }

    apply(state: HydratedWebOfPowerGameState) {
        this.metadata = state.refillDisplay()
    }
}
