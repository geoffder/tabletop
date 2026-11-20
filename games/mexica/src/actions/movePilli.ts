import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedMexicaGameState } from '../model/gameState.js'
import { assertExists } from '@tabletop/common'
import { CellSchema } from '../model/board.js'
import { payFor } from './payment.js'

export type MovePilliMetadata = Type.Static<typeof MovePilliMetadata>
export const MovePilliMetadata = Type.Object({
    tokensSpent: Type.Integer({ minimum: 0 }),
    cost: Type.Integer({ minimum: 1 }),
    teleport: Type.Boolean(),
    // Every cell passed on the way, start and end included; a teleport has just the two.
    path: Type.Array(CellSchema, { minItems: 2 })
})

// The Pilli Mexica goes to the cell by the cheapest way the rules allow.
export type MovePilli = Type.Static<typeof MovePilli>
export const MovePilli = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.MovePilli),
            playerId: Type.String(),
            to: CellSchema,
            metadata: Type.Optional(MovePilliMetadata)
        })
    ])
)

export const MovePilliValidator = Compile(MovePilli)

export function isMovePilli(action?: GameAction): action is MovePilli {
    return action?.type === ActionType.MovePilli
}

export class HydratedMovePilli extends HydratableAction<typeof MovePilli> implements MovePilli {
    declare type: ActionType.MovePilli
    declare playerId: string
    declare to: number
    declare metadata?: MovePilliMetadata

    constructor(data: MovePilli) {
        super(data, MovePilliValidator)
    }

    apply(state: HydratedMexicaGameState) {
        const move = state.moveTo(this.playerId, this.to)
        assertExists(move, 'The move must be affordable')
        this.metadata = {
            ...payFor(state, this.playerId, move.cost),
            cost: move.cost,
            teleport: move.teleport,
            path: move.path
        }
        state.placePilli(this.playerId, this.to)
    }
}
