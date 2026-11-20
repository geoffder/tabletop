import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import type { HydratedWebOfPowerGameState } from '../model/gameState.js'
import { HydratedDrawFaceUp, isDrawFaceUp } from '../actions/drawFaceUp.js'
import { HydratedDrawFromDeck, isDrawFromDeck } from '../actions/drawFromDeck.js'
import { afterDrawing, afterExhaustion, turnHolder } from './turnFlow.js'

type DrawingAction = HydratedDrawFaceUp | HydratedDrawFromDeck

// The player fills their hand back to three, a card at a time, from the face-up cards or the deck.
export class DrawingStateHandler implements MachineStateHandler<
    DrawingAction,
    HydratedWebOfPowerGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedWebOfPowerGameState>
    ): action is DrawingAction {
        const state = context.gameState
        if (action.playerId !== turnHolder(state)) return false
        if (isDrawFaceUp(action)) return state.display.includes(action.card)
        return isDrawFromDeck(action) && !state.deck.isEmpty()
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedWebOfPowerGameState>
    ): ActionType[] {
        const state = context.gameState
        if (playerId !== turnHolder(state)) return []
        return [
            ...(state.display.length > 0 ? [ActionType.DrawFaceUp] : []),
            ...(!state.deck.isEmpty() ? [ActionType.DrawFromDeck] : [])
        ]
    }

    enter(context: MachineContext<HydratedWebOfPowerGameState>) {
        context.gameState.activePlayerIds = [turnHolder(context.gameState)]
    }

    onAction(
        action: DrawingAction,
        context: MachineContext<HydratedWebOfPowerGameState>
    ): MachineState {
        if (isDrawFromDeck(action) && action.metadata?.exhausted === true) {
            return afterExhaustion(context.gameState)
        }
        return afterDrawing(context.gameState)
    }
}
