import { ActionType } from './actions.js'
import { ChooseStart } from '../actions/chooseStart.js'
import { DigCanal } from '../actions/digCanal.js'
import { BuildBridge } from '../actions/buildBridge.js'
import { MoveBridge } from '../actions/moveBridge.js'
import { BuildTemple } from '../actions/buildTemple.js'
import { MovePilli } from '../actions/movePilli.js'
import { FoundDistrict } from '../actions/foundDistrict.js'
import { TakeToken } from '../actions/takeToken.js'
import { EndTurn } from '../actions/endTurn.js'

export const MexicaApiActions = {
    [ActionType.ChooseStart]: ChooseStart,
    [ActionType.DigCanal]: DigCanal,
    [ActionType.BuildBridge]: BuildBridge,
    [ActionType.MoveBridge]: MoveBridge,
    [ActionType.BuildTemple]: BuildTemple,
    [ActionType.MovePilli]: MovePilli,
    [ActionType.FoundDistrict]: FoundDistrict,
    [ActionType.TakeToken]: TakeToken,
    [ActionType.EndTurn]: EndTurn
}
