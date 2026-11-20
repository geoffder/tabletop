import { ActionType } from './actions.js'
import { PlacePiece } from '../actions/placePiece.js'
import { EndPlacing } from '../actions/endPlacing.js'
import { ExchangeCard } from '../actions/exchangeCard.js'
import { Pass } from '../actions/pass.js'
import { DrawFaceUp } from '../actions/drawFaceUp.js'
import { DrawFromDeck } from '../actions/drawFromDeck.js'

export const WebOfPowerApiActions = {
    [ActionType.PlacePiece]: PlacePiece,
    [ActionType.EndPlacing]: EndPlacing,
    [ActionType.ExchangeCard]: ExchangeCard,
    [ActionType.Pass]: Pass,
    [ActionType.DrawFaceUp]: DrawFaceUp,
    [ActionType.DrawFromDeck]: DrawFromDeck
}
