import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedWebOfPowerGameState } from '../model/gameState.js'
import { CardColor, CardColorSchema } from '../model/map.js'

// Takes one of the face-up cards. Cards of one colour are alike, so the colour says which.
export type DrawFaceUp = Type.Static<typeof DrawFaceUp>
export const DrawFaceUp = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.DrawFaceUp),
            playerId: Type.String(),
            card: CardColorSchema
        })
    ])
)

export const DrawFaceUpValidator = Compile(DrawFaceUp)

export function isDrawFaceUp(action?: GameAction): action is DrawFaceUp {
    return action?.type === ActionType.DrawFaceUp
}

export class HydratedDrawFaceUp extends HydratableAction<typeof DrawFaceUp> implements DrawFaceUp {
    declare type: ActionType.DrawFaceUp
    declare playerId: string
    declare card: CardColor

    constructor(data: DrawFaceUp) {
        super(data, DrawFaceUpValidator)
    }

    apply(state: HydratedWebOfPowerGameState) {
        state.takeFaceUp(this.card)
        state.getPlayerState(this.playerId).takeCard(this.card)
    }
}
