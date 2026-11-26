import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { assertExists, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedHomeworldsGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { Power, type PowerUse } from '../model/powers.js'
import { PieceId, PieceKind } from '../model/pieces.js'
import { SystemId } from '../model/starMap.js'

export type DiscoverMetadata = Type.Static<typeof DiscoverMetadata>
export const DiscoverMetadata = Type.Object({
    starPiece: PieceId,
    fromSystemId: SystemId,
    abandonedStars: Type.Array(PieceId),
    turnEnded: Type.Optional(Type.Boolean())
})

export type Discover = Type.Static<typeof Discover>
export const Discover = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Discover),
            playerId: Type.String(),
            ship: PieceId,
            star: PieceKind,
            metadata: Type.Optional(DiscoverMetadata)
        })
    ])
)

export const DiscoverValidator = Compile(Discover)

export function isDiscover(action?: GameAction): action is Discover {
    return action?.type === ActionType.Discover
}

export class HydratedDiscover extends HydratableAction<typeof Discover> implements Discover {
    declare type: ActionType.Discover
    declare playerId: string
    declare ship: number
    declare star: PieceKind
    declare metadata?: DiscoverMetadata

    constructor(data: Discover) {
        super(data, DiscoverValidator)
    }

    use(): PowerUse {
        return { power: Power.Discover, ship: this.ship, star: this.star }
    }

    isValid(state: HydratedHomeworldsGameState): boolean {
        return state.canUse(this.playerId, this.use())
    }

    apply(state: HydratedHomeworldsGameState, _context?: MachineContext) {
        if (!this.isValid(state)) {
            throw Error('Invalid Discover action')
        }
        const { piece, fromSystemId, abandonedStars } = state.usePower(this.playerId, this.use())
        assertExists(piece, 'A discovery takes a star')
        assertExists(fromSystemId, 'A discovery leaves a system')
        this.metadata = { starPiece: piece, fromSystemId, abandonedStars: abandonedStars ?? [] }
    }
}
