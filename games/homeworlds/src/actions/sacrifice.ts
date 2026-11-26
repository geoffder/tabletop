import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedHomeworldsGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { PieceId } from '../model/pieces.js'
import { SystemId } from '../model/starMap.js'

export type SacrificeMetadata = Type.Static<typeof SacrificeMetadata>
export const SacrificeMetadata = Type.Object({
    systemId: SystemId,
    abandonedStars: Type.Array(PieceId),
    turnEnded: Type.Optional(Type.Boolean())
})

export type Sacrifice = Type.Static<typeof Sacrifice>
export const Sacrifice = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Sacrifice),
            playerId: Type.String(),
            ship: PieceId,
            metadata: Type.Optional(SacrificeMetadata)
        })
    ])
)

export const SacrificeValidator = Compile(Sacrifice)

export function isSacrifice(action?: GameAction): action is Sacrifice {
    return action?.type === ActionType.Sacrifice
}

export class HydratedSacrifice extends HydratableAction<typeof Sacrifice> implements Sacrifice {
    declare type: ActionType.Sacrifice
    declare playerId: string
    declare ship: number
    declare metadata?: SacrificeMetadata

    constructor(data: Sacrifice) {
        super(data, SacrificeValidator)
    }

    isValid(state: HydratedHomeworldsGameState): boolean {
        return state.canSacrifice(this.playerId, this.ship)
    }

    apply(state: HydratedHomeworldsGameState, _context?: MachineContext) {
        if (!this.isValid(state)) {
            throw Error('Invalid Sacrifice action')
        }
        this.metadata = state.sacrificeShip(this.ship)
    }
}
