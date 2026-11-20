import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedMexicaGameState } from '../model/gameState.js'
import { CellSchema } from '../model/board.js'
import { type Level, LevelSchema } from '../model/pieces.js'
import { PaidMetadata, payFor } from './payment.js'
// A temple costs one action point per level.
export type BuildTemple = Type.Static<typeof BuildTemple>
export const BuildTemple = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.BuildTemple),
            playerId: Type.String(),
            cell: CellSchema,
            level: LevelSchema,
            metadata: Type.Optional(PaidMetadata)
        })
    ])
)

export const BuildTempleValidator = Compile(BuildTemple)

export function isBuildTemple(action?: GameAction): action is BuildTemple {
    return action?.type === ActionType.BuildTemple
}

export class HydratedBuildTemple
    extends HydratableAction<typeof BuildTemple>
    implements BuildTemple
{
    declare type: ActionType.BuildTemple
    declare playerId: string
    declare cell: number
    declare level: Level
    declare metadata?: PaidMetadata

    constructor(data: BuildTemple) {
        super(data, BuildTempleValidator)
    }

    apply(state: HydratedMexicaGameState) {
        this.metadata = payFor(state, this.playerId, this.level)
        state.buildTemple(this.playerId, this.cell, this.level)
    }
}
