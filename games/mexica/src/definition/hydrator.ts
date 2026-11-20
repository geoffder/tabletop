import { GameAction, type GameHydrator, type HydratedAction } from '@tabletop/common'
import { HydratedMexicaGameState, type MexicaGameState } from '../model/gameState.js'
import { HydratedChooseStart, isChooseStart } from '../actions/chooseStart.js'
import { HydratedDigCanal, isDigCanal } from '../actions/digCanal.js'
import { HydratedBuildBridge, isBuildBridge } from '../actions/buildBridge.js'
import { HydratedMoveBridge, isMoveBridge } from '../actions/moveBridge.js'
import { HydratedBuildTemple, isBuildTemple } from '../actions/buildTemple.js'
import { HydratedMovePilli, isMovePilli } from '../actions/movePilli.js'
import { HydratedFoundDistrict, isFoundDistrict } from '../actions/foundDistrict.js'
import { HydratedTakeToken, isTakeToken } from '../actions/takeToken.js'
import { HydratedEndTurn, isEndTurn } from '../actions/endTurn.js'
import { HydratedRemoveTokens, isRemoveTokens } from '../actions/removeTokens.js'
import { HydratedScorePeriod, isScorePeriod } from '../actions/scorePeriod.js'

export class MexicaHydrator implements GameHydrator<MexicaGameState, HydratedMexicaGameState> {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isChooseStart(data):
                return new HydratedChooseStart(data)
            case isDigCanal(data):
                return new HydratedDigCanal(data)
            case isBuildBridge(data):
                return new HydratedBuildBridge(data)
            case isMoveBridge(data):
                return new HydratedMoveBridge(data)
            case isBuildTemple(data):
                return new HydratedBuildTemple(data)
            case isMovePilli(data):
                return new HydratedMovePilli(data)
            case isFoundDistrict(data):
                return new HydratedFoundDistrict(data)
            case isTakeToken(data):
                return new HydratedTakeToken(data)
            case isEndTurn(data):
                return new HydratedEndTurn(data)
            case isRemoveTokens(data):
                return new HydratedRemoveTokens(data)
            case isScorePeriod(data):
                return new HydratedScorePeriod(data)
            default:
                throw new Error(`Unknown action type ${data.type}`)
        }
    }

    hydrateState(state: MexicaGameState): HydratedMexicaGameState {
        return new HydratedMexicaGameState(state)
    }
}
