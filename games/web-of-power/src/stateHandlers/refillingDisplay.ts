import {
    ActionSource,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import type { HydratedWebOfPowerGameState } from '../model/gameState.js'
import { HydratedRefillDisplay, isRefillDisplay, RefillDisplay } from '../actions/refillDisplay.js'
import { afterExhaustion, finishTurn } from './turnFlow.js'

export class RefillingDisplayStateHandler implements MachineStateHandler<
    HydratedRefillDisplay,
    HydratedWebOfPowerGameState
> {
    isValidAction(action: HydratedAction): action is HydratedRefillDisplay {
        return isRefillDisplay(action) && action.source === ActionSource.System
    }

    validActionsForPlayer(): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedWebOfPowerGameState>) {
        context.addSystemAction(RefillDisplay, { revealsInfo: true })
    }

    onAction(
        action: HydratedRefillDisplay,
        context: MachineContext<HydratedWebOfPowerGameState>
    ): MachineState {
        if (action.metadata?.exhausted === true) return afterExhaustion(context.gameState)
        return finishTurn(context.gameState)
    }
}
