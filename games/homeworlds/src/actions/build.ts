import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { assertExists, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedHomeworldsGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { Power, type PowerUse } from '../model/powers.js'
import { PieceId, PyramidColor } from '../model/pieces.js'
import { SystemId } from '../model/starMap.js'

export type BuildMetadata = Type.Static<typeof BuildMetadata>
export const BuildMetadata = Type.Object({
    piece: PieceId,
    turnEnded: Type.Optional(Type.Boolean())
})

export type Build = Type.Static<typeof Build>
export const Build = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Build),
            playerId: Type.String(),
            systemId: SystemId,
            color: Type.Enum(PyramidColor),
            metadata: Type.Optional(BuildMetadata)
        })
    ])
)

export const BuildValidator = Compile(Build)

export function isBuild(action?: GameAction): action is Build {
    return action?.type === ActionType.Build
}

export class HydratedBuild extends HydratableAction<typeof Build> implements Build {
    declare type: ActionType.Build
    declare playerId: string
    declare systemId: number
    declare color: PyramidColor
    declare metadata?: BuildMetadata

    constructor(data: Build) {
        super(data, BuildValidator)
    }

    use(): PowerUse {
        return { power: Power.Build, systemId: this.systemId, color: this.color }
    }

    isValid(state: HydratedHomeworldsGameState): boolean {
        return state.canUse(this.playerId, this.use())
    }

    apply(state: HydratedHomeworldsGameState, _context?: MachineContext) {
        if (!this.isValid(state)) {
            throw Error('Invalid Build action')
        }
        const { piece } = state.usePower(this.playerId, this.use())
        assertExists(piece, 'A build takes a piece')
        this.metadata = { piece }
    }
}
