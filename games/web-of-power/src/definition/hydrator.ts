import { GameAction, type GameHydrator, type HydratedAction } from '@tabletop/common'
import { HydratedWebOfPowerGameState, type WebOfPowerProjectedState } from '../model/gameState.js'
import { HydratedPlacePiece, isPlacePiece } from '../actions/placePiece.js'
import { HydratedEndPlacing, isEndPlacing } from '../actions/endPlacing.js'
import { HydratedExchangeCard, isExchangeCard } from '../actions/exchangeCard.js'
import { HydratedPass, isPass } from '../actions/pass.js'
import { HydratedDrawFaceUp, isDrawFaceUp } from '../actions/drawFaceUp.js'
import { HydratedDrawFromDeck, isDrawFromDeck } from '../actions/drawFromDeck.js'
import { HydratedRefillDisplay, isRefillDisplay } from '../actions/refillDisplay.js'
import { HydratedScoreInterim, isScoreInterim } from '../actions/scoreInterim.js'
import { HydratedScoreFinal, isScoreFinal } from '../actions/scoreFinal.js'

export class WebOfPowerHydrator implements GameHydrator<
    WebOfPowerProjectedState,
    HydratedWebOfPowerGameState
> {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isPlacePiece(data):
                return new HydratedPlacePiece(data)
            case isEndPlacing(data):
                return new HydratedEndPlacing(data)
            case isExchangeCard(data):
                return new HydratedExchangeCard(data)
            case isPass(data):
                return new HydratedPass(data)
            case isDrawFaceUp(data):
                return new HydratedDrawFaceUp(data)
            case isDrawFromDeck(data):
                return new HydratedDrawFromDeck(data)
            case isRefillDisplay(data):
                return new HydratedRefillDisplay(data)
            case isScoreInterim(data):
                return new HydratedScoreInterim(data)
            case isScoreFinal(data):
                return new HydratedScoreFinal(data)
            default:
                throw new Error(`Unknown action type ${data.type}`)
        }
    }

    hydrateState(state: WebOfPowerProjectedState): HydratedWebOfPowerGameState {
        return new HydratedWebOfPowerGameState(state)
    }
}
