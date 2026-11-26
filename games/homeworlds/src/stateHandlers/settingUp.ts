import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedCreateHomeworld, isCreateHomeworld } from '../actions/createHomeworld.js'
import { HydratedHomeworldsGameState } from '../model/gameState.js'
import { turnHolder } from './turnFlow.js'

// The first player builds a homeworld, then the second, seeing it; then the first player starts.
export class SettingUpStateHandler implements MachineStateHandler<
    HydratedCreateHomeworld,
    HydratedHomeworldsGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedHomeworldsGameState>
    ): action is HydratedCreateHomeworld {
        return isCreateHomeworld(action)
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedHomeworldsGameState>
    ): ActionType[] {
        return [ActionType.CreateHomeworld]
    }

    enter(context: MachineContext<HydratedHomeworldsGameState>) {
        context.gameState.activePlayerIds = [turnHolder(context.gameState)]
    }

    onAction(
        _action: HydratedCreateHomeworld,
        context: MachineContext<HydratedHomeworldsGameState>
    ): MachineState {
        const { gameState } = context
        gameState.turnManager.endTurn(gameState.actionCount)
        const next = gameState.turnManager.startNextTurn(gameState.actionCount)
        if (!gameState.everyoneHasAHomeworld()) return MachineState.SettingUp
        gameState.recordPosition(next)
        return MachineState.TakingTurn
    }
}
