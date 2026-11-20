import {
    ActionSource,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import type { HydratedMexicaGameState } from '../model/gameState.js'
import { HydratedScorePeriod, isScorePeriod, ScorePeriod } from '../actions/scorePeriod.js'
import { startPeriod } from './turnFlow.js'

export class PeriodScoringStateHandler implements MachineStateHandler<
    HydratedScorePeriod,
    HydratedMexicaGameState
> {
    isValidAction(action: HydratedAction): action is HydratedScorePeriod {
        return isScorePeriod(action) && action.source === ActionSource.System
    }

    validActionsForPlayer(): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedMexicaGameState>) {
        context.gameState.activePlayerIds = []
        context.addSystemAction(ScorePeriod)
    }

    onAction(
        _action: HydratedScorePeriod,
        context: MachineContext<HydratedMexicaGameState>
    ): MachineState {
        const state = context.gameState
        return state.result === undefined ? startPeriod(state) : MachineState.EndOfGame
    }
}
