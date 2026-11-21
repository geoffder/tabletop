import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, Visibility } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedWebOfPowerGameState } from '../model/gameState.js'
import { CardColorSchema } from '../model/map.js'

export type DrawFromDeckResult = Type.Static<typeof DrawFromDeckResult>
export const DrawFromDeckResult = Type.Object({
    // Only the drawing player learns the card.
    card: Visibility.protect(CardColorSchema, { policy: Visibility.Policy.Actor }),
    exhausted: Type.Boolean()
})

export type DrawFromDeck = Type.Static<typeof DrawFromDeck>
export const DrawFromDeck = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.DrawFromDeck),
            playerId: Type.String(),
            revealsInfo: Type.Literal(true),
            metadata: Type.Optional(DrawFromDeckResult)
        })
    ])
)

export const DrawFromDeckValidator = Compile(DrawFromDeck)

export function isDrawFromDeck(action?: GameAction): action is DrawFromDeck {
    return action?.type === ActionType.DrawFromDeck
}

export class HydratedDrawFromDeck
    extends HydratableAction<typeof DrawFromDeck>
    implements DrawFromDeck
{
    declare type: ActionType.DrawFromDeck
    declare playerId: string
    declare revealsInfo: true
    declare metadata?: DrawFromDeckResult

    constructor(data: DrawFromDeck) {
        super(data, DrawFromDeckValidator)
    }

    apply(state: HydratedWebOfPowerGameState) {
        const { card, exhausted } = state.drawFromDeck()
        state.getPlayerState(this.playerId).takeCard(card)
        this.metadata = { card, exhausted }
    }
}
