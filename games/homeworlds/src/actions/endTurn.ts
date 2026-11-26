import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedHomeworldsGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'

export type EndTurnMetadata = Type.Static<typeof EndTurnMetadata>
export const EndTurnMetadata = Type.Object({
    // Ending the turn before any action passes it.
    passed: Type.Boolean(),
    // Sacrifice actions left unused.
    unused: Type.Integer({ minimum: 0 })
})

export type EndTurn = Type.Static<typeof EndTurn>
export const EndTurn = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.EndTurn),
            playerId: Type.String(),

            metadata: Type.Optional(EndTurnMetadata)
        })
    ])
)

export const EndTurnValidator = Compile(EndTurn)

export function isEndTurn(action?: GameAction): action is EndTurn {
    return action?.type === ActionType.EndTurn
}

export class HydratedEndTurn extends HydratableAction<typeof EndTurn> implements EndTurn {
    declare type: ActionType.EndTurn
    declare playerId: string

    declare metadata?: EndTurnMetadata

    constructor(data: EndTurn) {
        super(data, EndTurnValidator)
    }

    apply(state: HydratedHomeworldsGameState, _context?: MachineContext) {
        this.metadata = {
            passed: state.machineState === MachineState.TakingTurn,
            unused: state.sacrifice?.remaining ?? 0
        }
    }
}
