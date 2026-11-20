import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { fasterVariantFromConfig } from '../definition/config.js'
import type { HydratedWebOfPowerGameState } from '../model/gameState.js'
import { HydratedPlacePiece, isPlacePiece } from '../actions/placePiece.js'
import { HydratedEndPlacing, isEndPlacing } from '../actions/endPlacing.js'
import { HydratedExchangeCard, isExchangeCard } from '../actions/exchangeCard.js'
import { HydratedPass, isPass } from '../actions/pass.js'
import { afterPlacing, finishTurn, turnHolder } from './turnFlow.js'

type PlacingAction = HydratedPlacePiece | HydratedEndPlacing | HydratedExchangeCard | HydratedPass

export class PlacingPiecesStateHandler implements MachineStateHandler<
    PlacingAction,
    HydratedWebOfPowerGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedWebOfPowerGameState>
    ): action is PlacingAction {
        const state = context.gameState
        if (action.playerId !== turnHolder(state)) return false
        const faster = fasterVariantFromConfig(context.gameConfig)
        if (isPlacePiece(action)) {
            return (
                state.canPlace(action.playerId, action, faster) &&
                state.canPay(action.playerId, action.cards, action.country)
            )
        }
        if (isEndPlacing(action)) return state.placements.length > 0
        if (isExchangeCard(action)) {
            return (
                state.placements.length === 0 &&
                state.canDraw() &&
                state.getPlayerState(action.playerId).holds([action.card])
            )
        }
        if (isPass(action)) return state.placements.length === 0 && state.isFinalRound()
        return false
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedWebOfPowerGameState>
    ): ActionType[] {
        const state = context.gameState
        if (playerId !== turnHolder(state)) return []
        const actions: ActionType[] = []
        if (state.canPlaceAnything(playerId, fasterVariantFromConfig(context.gameConfig))) {
            actions.push(ActionType.PlacePiece)
        }
        if (state.placements.length > 0) {
            actions.push(ActionType.EndPlacing)
        } else {
            if (state.canDraw() && state.getPlayerState(playerId).handCount > 0) {
                actions.push(ActionType.ExchangeCard)
            }
            if (state.isFinalRound()) actions.push(ActionType.Pass)
        }
        return actions
    }

    enter(context: MachineContext<HydratedWebOfPowerGameState>) {
        context.gameState.activePlayerIds = [turnHolder(context.gameState)]
    }

    onAction(
        action: PlacingAction,
        context: MachineContext<HydratedWebOfPowerGameState>
    ): MachineState {
        const state = context.gameState
        if (isPlacePiece(action)) {
            // The turn goes on only while a second piece could still go down.
            const more =
                state.placements.length < 2 &&
                state.canPlaceAnything(action.playerId, fasterVariantFromConfig(context.gameConfig))
            return more ? MachineState.PlacingPieces : afterPlacing(state)
        }
        if (isEndPlacing(action)) return afterPlacing(state)
        if (isExchangeCard(action)) return MachineState.Drawing
        return finishTurn(state)
    }
}
