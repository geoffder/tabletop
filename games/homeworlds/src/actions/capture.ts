import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { assertExists, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedHomeworldsGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { Power, type PowerUse } from '../model/powers.js'
import { PieceId } from '../model/pieces.js'

export type CaptureMetadata = Type.Static<typeof CaptureMetadata>
export const CaptureMetadata = Type.Object({
    fromOwnerId: Type.String(),
    turnEnded: Type.Optional(Type.Boolean())
})

export type Capture = Type.Static<typeof Capture>
export const Capture = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Capture),
            playerId: Type.String(),
            ship: PieceId,
            metadata: Type.Optional(CaptureMetadata)
        })
    ])
)

export const CaptureValidator = Compile(Capture)

export function isCapture(action?: GameAction): action is Capture {
    return action?.type === ActionType.Capture
}

export class HydratedCapture extends HydratableAction<typeof Capture> implements Capture {
    declare type: ActionType.Capture
    declare playerId: string
    declare ship: number
    declare metadata?: CaptureMetadata

    constructor(data: Capture) {
        super(data, CaptureValidator)
    }

    use(): PowerUse {
        return { power: Power.Capture, ship: this.ship }
    }

    isValid(state: HydratedHomeworldsGameState): boolean {
        return state.canUse(this.playerId, this.use())
    }

    apply(state: HydratedHomeworldsGameState, _context?: MachineContext) {
        if (!this.isValid(state)) {
            throw Error('Invalid Capture action')
        }
        const { fromOwnerId } = state.usePower(this.playerId, this.use())
        assertExists(fromOwnerId, 'A capture takes a ship from its owner')
        this.metadata = { fromOwnerId }
    }
}
