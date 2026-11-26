import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedSacrifice, isSacrifice } from '../actions/sacrifice.js'
import { HydratedCatastrophe, isCatastrophe } from '../actions/catastrophe.js'
import { HydratedEndTurn, isEndTurn } from '../actions/endTurn.js'
import { HydratedHomeworldsGameState } from '../model/gameState.js'
import { POWER_ACTION_TYPES } from './powerActionTypes.js'
import { continueTurn, endTurn, isPowerAction, type PowerAction, turnHolder } from './turnFlow.js'

type TakingTurnAction = PowerAction | HydratedSacrifice | HydratedCatastrophe | HydratedEndTurn

// One action with a power the player has where their ship is, or a sacrifice; catastrophes may
// be declared first; ending the turn here passes.
export class TakingTurnStateHandler implements MachineStateHandler<
    TakingTurnAction,
    HydratedHomeworldsGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedHomeworldsGameState>
    ): action is TakingTurnAction {
        return (
            isPowerAction(action) ||
            isSacrifice(action) ||
            isCatastrophe(action) ||
            isEndTurn(action)
        )
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedHomeworldsGameState>
    ): ActionType[] {
        return [
            ...POWER_ACTION_TYPES,
            ActionType.Sacrifice,
            ActionType.Catastrophe,
            ActionType.EndTurn
        ]
    }

    enter(context: MachineContext<HydratedHomeworldsGameState>) {
        context.gameState.activePlayerIds = [turnHolder(context.gameState)]
    }

    onAction(
        action: TakingTurnAction,
        context: MachineContext<HydratedHomeworldsGameState>
    ): MachineState {
        const { gameState } = context
        if (isEndTurn(action)) return endTurn(gameState, gameState.actionCount)
        const next = isCatastrophe(action)
            ? MachineState.TakingTurn
            : isSacrifice(action)
              ? MachineState.SacrificeActions
              : MachineState.FinishingTurn
        return continueTurn(action, gameState, next, gameState.actionCount)
    }
}
