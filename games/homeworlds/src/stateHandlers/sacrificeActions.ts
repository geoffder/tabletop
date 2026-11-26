import {
    assertExists,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedCatastrophe, isCatastrophe } from '../actions/catastrophe.js'
import { HydratedEndTurn, isEndTurn } from '../actions/endTurn.js'
import { HydratedHomeworldsGameState } from '../model/gameState.js'
import { POWER_ACTION_TYPES } from './powerActionTypes.js'
import { continueTurn, endTurn, isPowerAction, type PowerAction, turnHolder } from './turnFlow.js'

type SacrificeAction = PowerAction | HydratedCatastrophe | HydratedEndTurn

// Each action is the sacrificed ship's colour, used wherever the player has a ship; any left
// over are lost when the turn ends.
export class SacrificeActionsStateHandler implements MachineStateHandler<
    SacrificeAction,
    HydratedHomeworldsGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedHomeworldsGameState>
    ): action is SacrificeAction {
        return isPowerAction(action) || isCatastrophe(action) || isEndTurn(action)
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedHomeworldsGameState>
    ): ActionType[] {
        return [...POWER_ACTION_TYPES, ActionType.Catastrophe, ActionType.EndTurn]
    }

    enter(context: MachineContext<HydratedHomeworldsGameState>) {
        context.gameState.activePlayerIds = [turnHolder(context.gameState)]
    }

    onAction(
        action: SacrificeAction,
        context: MachineContext<HydratedHomeworldsGameState>
    ): MachineState {
        const { gameState } = context
        if (isEndTurn(action)) return endTurn(gameState, gameState.actionCount)
        if (isCatastrophe(action)) {
            return continueTurn(
                action,
                gameState,
                MachineState.SacrificeActions,
                gameState.actionCount
            )
        }
        const { sacrifice } = gameState
        assertExists(sacrifice, 'Sacrifice actions come from a sacrifice')
        if (sacrifice.remaining > 1) {
            sacrifice.remaining -= 1
            return continueTurn(
                action,
                gameState,
                MachineState.SacrificeActions,
                gameState.actionCount
            )
        }
        gameState.sacrifice = undefined
        return continueTurn(action, gameState, MachineState.FinishingTurn, gameState.actionCount)
    }
}
