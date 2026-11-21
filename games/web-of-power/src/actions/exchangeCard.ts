import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedWebOfPowerGameState } from '../model/gameState.js'
import { CardColor, CardColorSchema } from '../model/map.js'

export type ExchangeCard = Type.Static<typeof ExchangeCard>
export const ExchangeCard = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ExchangeCard),
            playerId: Type.String(),
            card: CardColorSchema
        })
    ])
)

export const ExchangeCardValidator = Compile(ExchangeCard)

export function isExchangeCard(action?: GameAction): action is ExchangeCard {
    return action?.type === ActionType.ExchangeCard
}

export class HydratedExchangeCard
    extends HydratableAction<typeof ExchangeCard>
    implements ExchangeCard
{
    declare type: ActionType.ExchangeCard
    declare playerId: string
    declare card: CardColor

    constructor(data: ExchangeCard) {
        super(data, ExchangeCardValidator)
    }

    apply(state: HydratedWebOfPowerGameState) {
        state.exchange(this.playerId, this.card)
    }
}
