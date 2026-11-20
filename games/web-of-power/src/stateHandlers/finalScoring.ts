import {
    ActionSource,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import type { HydratedWebOfPowerGameState } from '../model/gameState.js'
import { HydratedScoreFinal, isScoreFinal, ScoreFinal } from '../actions/scoreFinal.js'

export class FinalScoringStateHandler implements MachineStateHandler<
    HydratedScoreFinal,
    HydratedWebOfPowerGameState
> {
    isValidAction(action: HydratedAction): action is HydratedScoreFinal {
        return isScoreFinal(action) && action.source === ActionSource.System
    }

    validActionsForPlayer(): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedWebOfPowerGameState>) {
        context.addSystemAction(ScoreFinal)
    }

    onAction(): MachineState {
        return MachineState.EndOfGame
    }
}
