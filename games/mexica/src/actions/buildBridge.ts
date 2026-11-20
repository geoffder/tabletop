import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedMexicaGameState } from '../model/gameState.js'
import { Axis, AxisSchema, CellSchema } from '../model/board.js'
import { PaidMetadata, payFor } from './payment.js'
export type BuildBridge = Type.Static<typeof BuildBridge>
export const BuildBridge = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.BuildBridge),
            playerId: Type.String(),
            cell: CellSchema,
            axis: AxisSchema,
            metadata: Type.Optional(PaidMetadata)
        })
    ])
)

export const BuildBridgeValidator = Compile(BuildBridge)

export function isBuildBridge(action?: GameAction): action is BuildBridge {
    return action?.type === ActionType.BuildBridge
}

export class HydratedBuildBridge
    extends HydratableAction<typeof BuildBridge>
    implements BuildBridge
{
    declare type: ActionType.BuildBridge
    declare playerId: string
    declare cell: number
    declare axis: Axis
    declare metadata?: PaidMetadata

    constructor(data: BuildBridge) {
        super(data, BuildBridgeValidator)
    }

    apply(state: HydratedMexicaGameState) {
        this.metadata = payFor(state, this.playerId, 1)
        state.buildBridge(this.cell, this.axis)
    }
}
