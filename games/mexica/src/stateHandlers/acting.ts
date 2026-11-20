import {
    ActionSource,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import type { HydratedMexicaGameState } from '../model/gameState.js'
import { LEVELS } from '../model/pieces.js'
import { HydratedDigCanal, isDigCanal } from '../actions/digCanal.js'
import { HydratedBuildBridge, isBuildBridge } from '../actions/buildBridge.js'
import { HydratedMoveBridge, isMoveBridge } from '../actions/moveBridge.js'
import { HydratedBuildTemple, isBuildTemple } from '../actions/buildTemple.js'
import { HydratedMovePilli, isMovePilli } from '../actions/movePilli.js'
import { HydratedFoundDistrict, isFoundDistrict } from '../actions/foundDistrict.js'
import { HydratedTakeToken, isTakeToken } from '../actions/takeToken.js'
import { HydratedEndTurn, isEndTurn } from '../actions/endTurn.js'
import { HydratedRemoveTokens, isRemoveTokens, RemoveTokens } from '../actions/removeTokens.js'
import { endTurn, turnHolder } from './turnFlow.js'

type ActingAction =
    | HydratedDigCanal
    | HydratedBuildBridge
    | HydratedMoveBridge
    | HydratedBuildTemple
    | HydratedMovePilli
    | HydratedFoundDistrict
    | HydratedTakeToken
    | HydratedEndTurn
    | HydratedRemoveTokens

// A turn of six action points, spent on any actions in any order until the player ends it.
export class ActingStateHandler implements MachineStateHandler<
    ActingAction,
    HydratedMexicaGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedMexicaGameState>
    ): action is ActingAction {
        const state = context.gameState
        if (isRemoveTokens(action)) {
            return action.source === ActionSource.System && state.impossibleTokens().length > 0
        }
        if (action.playerId !== turnHolder(state)) return false
        const playerId = action.playerId
        if (isEndTurn(action)) return true
        if (isTakeToken(action)) return state.canTakeToken()
        if (isDigCanal(action)) {
            return (
                state.apAvailable(playerId) >= 1 &&
                state.canDig(action.cells) &&
                state.leavesEveryoneFree(playerId, (s) => s.dig(action.cells))
            )
        }
        if (isBuildBridge(action)) {
            return (
                state.apAvailable(playerId) >= 1 && state.canBuildBridge(action.cell, action.axis)
            )
        }
        if (isMoveBridge(action)) {
            return (
                state.apAvailable(playerId) >= 1 &&
                state.canMoveBridge(action.bridgeId, action.cell, action.axis) &&
                state.leavesEveryoneFree(playerId, (s) =>
                    s.moveBridge(action.bridgeId, action.cell, action.axis)
                )
            )
        }
        if (isBuildTemple(action)) {
            return (
                state.apAvailable(playerId) >= action.level &&
                state.canBuildTemple(playerId, action.cell, action.level) &&
                state.leavesEveryoneFree(playerId, (s) =>
                    s.buildTemple(playerId, action.cell, action.level)
                )
            )
        }
        if (isMovePilli(action)) {
            return (
                state.moveTo(playerId, action.to) !== undefined &&
                state.leavesEveryoneFree(playerId, (s) => s.placePilli(playerId, action.to))
            )
        }
        if (isFoundDistrict(action)) {
            return (
                state.canFound(playerId, action.cell) &&
                state.leavesEveryoneFree(playerId, (s) => s.found(playerId, action.cell))
            )
        }
        return false
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedMexicaGameState>
    ): ActionType[] {
        const state = context.gameState
        if (playerId !== turnHolder(state)) return []
        const ap = state.apAvailable(playerId)
        const actions: ActionType[] = []
        if (ap >= 1) {
            if (state.canalTilesLeft() > 0) actions.push(ActionType.DigCanal)
            if (state.bridgesLeft() > 0) actions.push(ActionType.BuildBridge)
            else actions.push(ActionType.MoveBridge)
            if (LEVELS.some((level) => level <= ap && state.templesLeft(playerId, level) > 0)) {
                actions.push(ActionType.BuildTemple)
            }
            actions.push(ActionType.MovePilli)
        }
        if (state.foundingToken(playerId) !== undefined) actions.push(ActionType.FoundDistrict)
        if (state.canTakeToken()) actions.push(ActionType.TakeToken)
        actions.push(ActionType.EndTurn)
        return actions
    }

    enter(context: MachineContext<HydratedMexicaGameState>) {
        const state = context.gameState
        state.activePlayerIds = [turnHolder(state)]
        if (state.impossibleTokens().length > 0) context.addSystemAction(RemoveTokens)
    }

    onAction(action: ActingAction, context: MachineContext<HydratedMexicaGameState>): MachineState {
        return isEndTurn(action) ? endTurn(context.gameState) : MachineState.Acting
    }
}
