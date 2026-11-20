import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'

// The player stops after one piece, leaving the second they could have placed.
export type EndPlacing = Type.Static<typeof EndPlacing>
export const EndPlacing = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.EndPlacing),
            playerId: Type.String()
        })
    ])
)

export const EndPlacingValidator = Compile(EndPlacing)

export function isEndPlacing(action?: GameAction): action is EndPlacing {
    return action?.type === ActionType.EndPlacing
}

export class HydratedEndPlacing extends HydratableAction<typeof EndPlacing> implements EndPlacing {
    declare type: ActionType.EndPlacing
    declare playerId: string

    constructor(data: EndPlacing) {
        super(data, EndPlacingValidator)
    }

    apply() {}
}
