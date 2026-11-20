import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedMexicaGameState } from '../model/gameState.js'
import { CellSchema } from '../model/board.js'
import { PaidMetadata, payFor } from './payment.js'
// A single tile covers one cell, a double two side by side.
export type DigCanal = Type.Static<typeof DigCanal>
export const DigCanal = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.DigCanal),
            playerId: Type.String(),
            cells: Type.Array(CellSchema, { minItems: 1, maxItems: 2 }),
            metadata: Type.Optional(PaidMetadata)
        })
    ])
)

export const DigCanalValidator = Compile(DigCanal)

export function isDigCanal(action?: GameAction): action is DigCanal {
    return action?.type === ActionType.DigCanal
}

export class HydratedDigCanal extends HydratableAction<typeof DigCanal> implements DigCanal {
    declare type: ActionType.DigCanal
    declare playerId: string
    declare cells: number[]
    declare metadata?: PaidMetadata

    constructor(data: DigCanal) {
        super(data, DigCanalValidator)
    }

    apply(state: HydratedMexicaGameState) {
        this.metadata = payFor(state, this.playerId, 1)
        state.dig(this.cells)
    }
}
