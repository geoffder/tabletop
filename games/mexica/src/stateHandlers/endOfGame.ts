import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import type { HydratedMexicaGameState } from '../model/gameState.js'

export class EndOfGameStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedMexicaGameState
> {
    isValidAction(_action: HydratedAction): _action is HydratedAction {
        return false
    }

    validActionsForPlayer(): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedMexicaGameState>) {
        context.gameState.activePlayerIds = []
    }

    onAction(): MachineState {
        throw Error('No actions valid in EndOfGame state')
    }
}
