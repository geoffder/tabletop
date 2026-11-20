import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedMexicaGameState } from '../model/gameState.js'
import { CellSchema } from '../model/board.js'
import { DistrictTokenSchema, placePoints, tokenSize } from '../model/pieces.js'

export type FoundDistrictMetadata = Type.Static<typeof FoundDistrictMetadata>
export const FoundDistrictMetadata = Type.Object({
    tokenId: DistrictTokenSchema,
    points: Type.Integer({ minimum: 0 }),
    // Other players whose Pilli Mexica stood in the district, and what each scored.
    visitors: Type.Array(Type.Object({ playerId: Type.String(), points: Type.Integer() }))
})

// The token goes on the cell; the Pilli Mexica must stand in the district. Founding is free.
export type FoundDistrict = Type.Static<typeof FoundDistrict>
export const FoundDistrict = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.FoundDistrict),
            playerId: Type.String(),
            cell: CellSchema,
            metadata: Type.Optional(FoundDistrictMetadata)
        })
    ])
)

export const FoundDistrictValidator = Compile(FoundDistrict)

export function isFoundDistrict(action?: GameAction): action is FoundDistrict {
    return action?.type === ActionType.FoundDistrict
}

export class HydratedFoundDistrict
    extends HydratableAction<typeof FoundDistrict>
    implements FoundDistrict
{
    declare type: ActionType.FoundDistrict
    declare playerId: string
    declare cell: number
    declare metadata?: FoundDistrictMetadata

    constructor(data: FoundDistrict) {
        super(data, FoundDistrictValidator)
    }

    apply(state: HydratedMexicaGameState) {
        const { tokenId, visitors } = state.found(this.playerId, this.cell)
        const [, second, third] = placePoints(tokenSize(tokenId))
        state.acted = true
        this.metadata = {
            tokenId,
            points: second,
            visitors: visitors.map((playerId) => ({ playerId, points: third }))
        }
    }
}
