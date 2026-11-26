import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { assertExists, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedHomeworldsGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { Power, type PowerUse } from '../model/powers.js'
import { PieceId, PyramidColor } from '../model/pieces.js'

export type TradeMetadata = Type.Static<typeof TradeMetadata>
export const TradeMetadata = Type.Object({
    // The piece the ship became.
    piece: PieceId,
    turnEnded: Type.Optional(Type.Boolean())
})

export type Trade = Type.Static<typeof Trade>
export const Trade = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Trade),
            playerId: Type.String(),
            ship: PieceId,
            color: Type.Enum(PyramidColor),
            metadata: Type.Optional(TradeMetadata)
        })
    ])
)

export const TradeValidator = Compile(Trade)

export function isTrade(action?: GameAction): action is Trade {
    return action?.type === ActionType.Trade
}

export class HydratedTrade extends HydratableAction<typeof Trade> implements Trade {
    declare type: ActionType.Trade
    declare playerId: string
    declare ship: number
    declare color: PyramidColor
    declare metadata?: TradeMetadata

    constructor(data: Trade) {
        super(data, TradeValidator)
    }

    use(): PowerUse {
        return { power: Power.Trade, ship: this.ship, color: this.color }
    }

    isValid(state: HydratedHomeworldsGameState): boolean {
        return state.canUse(this.playerId, this.use())
    }

    apply(state: HydratedHomeworldsGameState, _context?: MachineContext) {
        if (!this.isValid(state)) {
            throw Error('Invalid Trade action')
        }
        const { piece } = state.usePower(this.playerId, this.use())
        assertExists(piece, 'A trade takes a piece')
        this.metadata = { piece }
    }
}
