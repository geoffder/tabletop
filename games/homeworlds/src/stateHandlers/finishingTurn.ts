import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedCatastrophe, isCatastrophe } from '../actions/catastrophe.js'
import { HydratedEndTurn, isEndTurn } from '../actions/endTurn.js'
import { HydratedHomeworldsGameState } from '../model/gameState.js'
import { continueTurn, endTurn, turnHolder } from './turnFlow.js'

type FinishingAction = HydratedCatastrophe | HydratedEndTurn

// The actions are used; the player may still declare catastrophes before ending the turn.
export class FinishingTurnStateHandler implements MachineStateHandler<
    FinishingAction,
    HydratedHomeworldsGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedHomeworldsGameState>
    ): action is FinishingAction {
        return isCatastrophe(action) || isEndTurn(action)
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedHomeworldsGameState>
    ): ActionType[] {
        return [ActionType.Catastrophe, ActionType.EndTurn]
    }

    enter(context: MachineContext<HydratedHomeworldsGameState>) {
        context.gameState.activePlayerIds = [turnHolder(context.gameState)]
    }

    onAction(
        action: FinishingAction,
        context: MachineContext<HydratedHomeworldsGameState>
    ): MachineState {
        const { gameState } = context
        if (isEndTurn(action)) return endTurn(gameState, gameState.actionCount)
        return continueTurn(action, gameState, MachineState.FinishingTurn, gameState.actionCount)
    }
}
