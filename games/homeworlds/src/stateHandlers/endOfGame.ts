import {
    type HydratedAction,
    type MachineStateHandler,
    GameResult,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { EndReason, HydratedHomeworldsGameState } from '../model/gameState.js'

export class EndOfGameStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedHomeworldsGameState
> {
    isValidAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedHomeworldsGameState>
    ): _action is HydratedAction {
        return false
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedHomeworldsGameState>
    ): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedHomeworldsGameState>) {
        context.gameState.result =
            context.gameState.endReason === EndReason.Eliminated ? GameResult.Win : GameResult.Draw
        context.gameState.activePlayerIds = []
    }

    onAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedHomeworldsGameState>
    ): MachineState {
        throw Error('No actions valid in EndOfGame state')
    }
}
