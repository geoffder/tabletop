import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { assertExists, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedHomeworldsGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { Power, type PowerUse } from '../model/powers.js'
import { PieceId } from '../model/pieces.js'
import { SystemId } from '../model/starMap.js'

export type MoveMetadata = Type.Static<typeof MoveMetadata>
export const MoveMetadata = Type.Object({
    fromSystemId: SystemId,
    // The stars of a basic system the ship left empty, back in the Bank.
    abandonedStars: Type.Array(PieceId),
    turnEnded: Type.Optional(Type.Boolean())
})

export type Move = Type.Static<typeof Move>
export const Move = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Move),
            playerId: Type.String(),
            ship: PieceId,
            systemId: SystemId,
            metadata: Type.Optional(MoveMetadata)
        })
    ])
)

export const MoveValidator = Compile(Move)

export function isMove(action?: GameAction): action is Move {
    return action?.type === ActionType.Move
}

export class HydratedMove extends HydratableAction<typeof Move> implements Move {
    declare type: ActionType.Move
    declare playerId: string
    declare ship: number
    declare systemId: number
    declare metadata?: MoveMetadata

    constructor(data: Move) {
        super(data, MoveValidator)
    }

    use(): PowerUse {
        return { power: Power.Move, ship: this.ship, systemId: this.systemId }
    }

    isValid(state: HydratedHomeworldsGameState): boolean {
        return state.canUse(this.playerId, this.use())
    }

    apply(state: HydratedHomeworldsGameState, _context?: MachineContext) {
        if (!this.isValid(state)) {
            throw Error('Invalid Move action')
        }
        const { fromSystemId, abandonedStars } = state.usePower(this.playerId, this.use())
        assertExists(fromSystemId, 'A move leaves a system')
        this.metadata = { fromSystemId, abandonedStars: abandonedStars ?? [] }
    }
}
