import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedHomeworldsGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { PyramidColor } from '../model/pieces.js'
import { Destroyed, SystemId } from '../model/starMap.js'

export type CatastropheMetadata = Type.Static<typeof CatastropheMetadata>
export const CatastropheMetadata = Type.Object({
    destroyed: Destroyed,
    turnEnded: Type.Optional(Type.Boolean())
})

export type Catastrophe = Type.Static<typeof Catastrophe>
export const Catastrophe = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Catastrophe),
            playerId: Type.String(),
            systemId: SystemId,
            color: Type.Enum(PyramidColor),
            metadata: Type.Optional(CatastropheMetadata)
        })
    ])
)

export const CatastropheValidator = Compile(Catastrophe)

export function isCatastrophe(action?: GameAction): action is Catastrophe {
    return action?.type === ActionType.Catastrophe
}

export class HydratedCatastrophe
    extends HydratableAction<typeof Catastrophe>
    implements Catastrophe
{
    declare type: ActionType.Catastrophe
    declare playerId: string
    declare systemId: number
    declare color: PyramidColor
    declare metadata?: CatastropheMetadata

    constructor(data: Catastrophe) {
        super(data, CatastropheValidator)
    }

    isValid(state: HydratedHomeworldsGameState): boolean {
        return state.canDeclareCatastrophe(this.systemId, this.color)
    }

    apply(state: HydratedHomeworldsGameState, _context?: MachineContext) {
        if (!this.isValid(state)) {
            throw Error('Invalid Catastrophe action')
        }
        this.metadata = { destroyed: state.declareCatastrophe(this.systemId, this.color) }
    }
}
