import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedMexicaGameState } from '../model/gameState.js'
import { CellSchema } from '../model/board.js'
export type ChooseStart = Type.Static<typeof ChooseStart>
export const ChooseStart = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChooseStart),
            playerId: Type.String(),
            cell: CellSchema
        })
    ])
)

export const ChooseStartValidator = Compile(ChooseStart)

export function isChooseStart(action?: GameAction): action is ChooseStart {
    return action?.type === ActionType.ChooseStart
}

export class HydratedChooseStart
    extends HydratableAction<typeof ChooseStart>
    implements ChooseStart
{
    declare type: ActionType.ChooseStart
    declare playerId: string
    declare cell: number

    constructor(data: ChooseStart) {
        super(data, ChooseStartValidator)
    }

    apply(state: HydratedMexicaGameState) {
        state.placePilli(this.playerId, this.cell)
    }
}
