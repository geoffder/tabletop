import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import type { HydratedMexicaGameState } from '../model/gameState.js'
import { HydratedChooseStart, isChooseStart } from '../actions/chooseStart.js'
import { startPeriod, turnHolder } from './turnFlow.js'

// In turn order, each player puts their Pilli Mexica on a free starting space of the palace.
export class ChoosingStartStateHandler implements MachineStateHandler<
    HydratedChooseStart,
    HydratedMexicaGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedMexicaGameState>
    ): action is HydratedChooseStart {
        const state = context.gameState
        return (
            isChooseStart(action) &&
            action.playerId === turnHolder(state) &&
            state.canStartOn(action.cell)
        )
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedMexicaGameState>
    ): ActionType[] {
        return playerId === turnHolder(context.gameState) ? [ActionType.ChooseStart] : []
    }

    enter(context: MachineContext<HydratedMexicaGameState>) {
        context.gameState.activePlayerIds = [turnHolder(context.gameState)]
    }

    onAction(
        _action: HydratedChooseStart,
        context: MachineContext<HydratedMexicaGameState>
    ): MachineState {
        const state = context.gameState
        state.turnManager.endTurn(state.actionCount)
        if (state.players.every((player) => player.pilli !== undefined)) return startPeriod(state)
        state.turnManager.startNextTurn(state.actionCount)
        return MachineState.ChoosingStart
    }
}
