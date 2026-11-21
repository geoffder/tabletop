import {
    ActionSource,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import type { HydratedWebOfPowerGameState } from '../model/gameState.js'
import { HydratedScoreInterim, isScoreInterim, ScoreInterim } from '../actions/scoreInterim.js'
import { afterDrawing } from './turnFlow.js'

export class InterimScoringStateHandler implements MachineStateHandler<
    HydratedScoreInterim,
    HydratedWebOfPowerGameState
> {
    isValidAction(action: HydratedAction): action is HydratedScoreInterim {
        return isScoreInterim(action) && action.source === ActionSource.System
    }

    validActionsForPlayer(): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedWebOfPowerGameState>) {
        context.addSystemAction(ScoreInterim, { revealsInfo: true })
    }

    onAction(
        _action: HydratedScoreInterim,
        context: MachineContext<HydratedWebOfPowerGameState>
    ): MachineState {
        return afterDrawing(context.gameState)
    }
}
