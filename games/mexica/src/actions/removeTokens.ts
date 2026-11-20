import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedMexicaGameState } from '../model/gameState.js'
import { DistrictTokenSchema } from '../model/pieces.js'

export type RemoveTokensMetadata = Type.Static<typeof RemoveTokensMetadata>
export const RemoveTokensMetadata = Type.Object({
    tokenIds: Type.Array(DistrictTokenSchema, { minItems: 1 })
})

// Tokens no district can take any more leave the Emperor's commands.
export type RemoveTokens = Type.Static<typeof RemoveTokens>
export const RemoveTokens = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.RemoveTokens),
            metadata: Type.Optional(RemoveTokensMetadata)
        })
    ])
)

export const RemoveTokensValidator = Compile(RemoveTokens)

export function isRemoveTokens(action?: GameAction): action is RemoveTokens {
    return action?.type === ActionType.RemoveTokens
}

export class HydratedRemoveTokens
    extends HydratableAction<typeof RemoveTokens>
    implements RemoveTokens
{
    declare type: ActionType.RemoveTokens
    declare metadata?: RemoveTokensMetadata

    constructor(data: RemoveTokens) {
        super(data, RemoveTokensValidator)
    }

    apply(state: HydratedMexicaGameState) {
        const tokenIds = state.impossibleTokens()
        state.removeTokens(tokenIds)
        this.metadata = { tokenIds }
    }
}
