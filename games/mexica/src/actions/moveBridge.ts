import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { assertExists, GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedMexicaGameState } from '../model/gameState.js'
import { Axis, AxisSchema, CellSchema } from '../model/board.js'
import { Bridge } from '../model/pieces.js'
import { payFor } from './payment.js'

export type MoveBridgeMetadata = Type.Static<typeof MoveBridgeMetadata>
export const MoveBridgeMetadata = Type.Object({
    tokensSpent: Type.Integer({ minimum: 0 }),
    from: Bridge
})

export type MoveBridge = Type.Static<typeof MoveBridge>
export const MoveBridge = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.MoveBridge),
            playerId: Type.String(),
            // The square the moved bridge stands on.
            bridgeCell: CellSchema,
            cell: CellSchema,
            axis: AxisSchema,
            metadata: Type.Optional(MoveBridgeMetadata)
        })
    ])
)

export const MoveBridgeValidator = Compile(MoveBridge)

export function isMoveBridge(action?: GameAction): action is MoveBridge {
    return action?.type === ActionType.MoveBridge
}

export class HydratedMoveBridge extends HydratableAction<typeof MoveBridge> implements MoveBridge {
    declare type: ActionType.MoveBridge
    declare playerId: string
    declare bridgeCell: number
    declare cell: number
    declare axis: Axis
    declare metadata?: MoveBridgeMetadata

    constructor(data: MoveBridge) {
        super(data, MoveBridgeValidator)
    }

    apply(state: HydratedMexicaGameState) {
        const from = state.bridgeAt(this.bridgeCell)
        assertExists(from, 'A moved bridge must stand on its square')
        this.metadata = { ...payFor(state, this.playerId, 1), from: { ...from } }
        state.moveBridge(this.bridgeCell, this.cell, this.axis)
    }
}
