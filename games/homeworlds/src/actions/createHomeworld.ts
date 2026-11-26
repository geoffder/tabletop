import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedHomeworldsGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { PieceId, PieceKind, PyramidColor } from '../model/pieces.js'

export type CreateHomeworldMetadata = Type.Static<typeof CreateHomeworldMetadata>
export const CreateHomeworldMetadata = Type.Object({
    starPieces: Type.Array(PieceId, { minItems: 2, maxItems: 2 }),
    shipPiece: PieceId
})

export type CreateHomeworld = Type.Static<typeof CreateHomeworld>
export const CreateHomeworld = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.CreateHomeworld),
            playerId: Type.String(),
            stars: Type.Array(PieceKind, { minItems: 2, maxItems: 2 }),
            shipColor: Type.Enum(PyramidColor),
            metadata: Type.Optional(CreateHomeworldMetadata)
        })
    ])
)

export const CreateHomeworldValidator = Compile(CreateHomeworld)

export function isCreateHomeworld(action?: GameAction): action is CreateHomeworld {
    return action?.type === ActionType.CreateHomeworld
}

export class HydratedCreateHomeworld
    extends HydratableAction<typeof CreateHomeworld>
    implements CreateHomeworld
{
    declare type: ActionType.CreateHomeworld
    declare playerId: string
    declare stars: PieceKind[]
    declare shipColor: PyramidColor
    declare metadata?: CreateHomeworldMetadata

    constructor(data: CreateHomeworld) {
        super(data, CreateHomeworldValidator)
    }

    isValid(state: HydratedHomeworldsGameState): boolean {
        return state.canCreateHomeworld(this.playerId, this.stars, this.shipColor)
    }

    apply(state: HydratedHomeworldsGameState, _context?: MachineContext) {
        if (!this.isValid(state)) {
            throw Error('Invalid CreateHomeworld action')
        }
        const { stars, ship } = state.createHomeworld(this.playerId, this.stars, this.shipColor)
        this.metadata = { starPieces: stars, shipPiece: ship }
    }
}
