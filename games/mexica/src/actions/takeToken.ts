import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedMexicaGameState } from '../model/gameState.js'

// One action point now for one later, at most two a turn.
export type TakeToken = Type.Static<typeof TakeToken>
export const TakeToken = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.TakeToken),
            playerId: Type.String()
        })
    ])
)

export const TakeTokenValidator = Compile(TakeToken)

export function isTakeToken(action?: GameAction): action is TakeToken {
    return action?.type === ActionType.TakeToken
}

export class HydratedTakeToken extends HydratableAction<typeof TakeToken> implements TakeToken {
    declare type: ActionType.TakeToken
    declare playerId: string

    constructor(data: TakeToken) {
        super(data, TakeTokenValidator)
    }

    apply(state: HydratedMexicaGameState) {
        state.takeToken(this.playerId)
    }
}
