import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedMexicaGameState } from '../model/gameState.js'
import { Axis, AxisSchema, CellSchema } from '../model/board.js'
import { Bridge, BRIDGE_COUNT } from '../model/pieces.js'
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
            bridgeId: Type.Integer({ minimum: 0, maximum: BRIDGE_COUNT - 1 }),
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
    declare bridgeId: number
    declare cell: number
    declare axis: Axis
    declare metadata?: MoveBridgeMetadata

    constructor(data: MoveBridge) {
        super(data, MoveBridgeValidator)
    }

    apply(state: HydratedMexicaGameState) {
        const from = { ...state.bridges[this.bridgeId] }
        this.metadata = { ...payFor(state, this.playerId, 1), from }
        state.moveBridge(this.bridgeId, this.cell, this.axis)
    }
}
