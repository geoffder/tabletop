import { GameAction, type GameHydrator, type HydratedAction } from '@tabletop/common'
import { HydratedHomeworldsGameState, HomeworldsGameState } from '../model/gameState.js'
import { HydratedCreateHomeworld, isCreateHomeworld } from '../actions/createHomeworld.js'
import { HydratedBuild, isBuild } from '../actions/build.js'
import { HydratedMove, isMove } from '../actions/move.js'
import { HydratedDiscover, isDiscover } from '../actions/discover.js'
import { HydratedCapture, isCapture } from '../actions/capture.js'
import { HydratedTrade, isTrade } from '../actions/trade.js'
import { HydratedSacrifice, isSacrifice } from '../actions/sacrifice.js'
import { HydratedCatastrophe, isCatastrophe } from '../actions/catastrophe.js'
import { HydratedEndTurn, isEndTurn } from '../actions/endTurn.js'

export class HomeworldsHydrator implements GameHydrator<
    HomeworldsGameState,
    HydratedHomeworldsGameState
> {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isCreateHomeworld(data):
                return new HydratedCreateHomeworld(data)
            case isBuild(data):
                return new HydratedBuild(data)
            case isMove(data):
                return new HydratedMove(data)
            case isDiscover(data):
                return new HydratedDiscover(data)
            case isCapture(data):
                return new HydratedCapture(data)
            case isTrade(data):
                return new HydratedTrade(data)
            case isSacrifice(data):
                return new HydratedSacrifice(data)
            case isCatastrophe(data):
                return new HydratedCatastrophe(data)
            case isEndTurn(data):
                return new HydratedEndTurn(data)
            default:
                throw new Error(`Unknown action type ${data.type}`)
        }
    }

    hydrateState(state: HomeworldsGameState): HydratedHomeworldsGameState {
        return new HydratedHomeworldsGameState(state)
    }
}
