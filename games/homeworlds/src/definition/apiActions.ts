import { ActionType } from './actions.js'
import { CreateHomeworld } from '../actions/createHomeworld.js'
import { Build } from '../actions/build.js'
import { Move } from '../actions/move.js'
import { Discover } from '../actions/discover.js'
import { Capture } from '../actions/capture.js'
import { Trade } from '../actions/trade.js'
import { Sacrifice } from '../actions/sacrifice.js'
import { Catastrophe } from '../actions/catastrophe.js'
import { EndTurn } from '../actions/endTurn.js'

export const HomeworldsApiActions = {
    [ActionType.CreateHomeworld]: CreateHomeworld,
    [ActionType.Build]: Build,
    [ActionType.Move]: Move,
    [ActionType.Discover]: Discover,
    [ActionType.Capture]: Capture,
    [ActionType.Trade]: Trade,
    [ActionType.Sacrifice]: Sacrifice,
    [ActionType.Catastrophe]: Catastrophe,
    [ActionType.EndTurn]: EndTurn
}
