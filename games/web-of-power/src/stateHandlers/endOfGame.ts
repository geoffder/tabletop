import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import type { HydratedWebOfPowerGameState } from '../model/gameState.js'

export class EndOfGameStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedWebOfPowerGameState
> {
    isValidAction(_action: HydratedAction): _action is HydratedAction {
        return false
    }

    validActionsForPlayer(): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedWebOfPowerGameState>) {
        context.gameState.activePlayerIds = []
    }

    onAction(): MachineState {
        throw Error('No actions valid in EndOfGame state')
    }
}
