import type * as Type from 'typebox'
import { ActionType } from './actions.js'
import { WebOfPowerApiActions } from './apiActions.js'
import { RefillDisplay } from '../actions/refillDisplay.js'
import { ScoreInterim } from '../actions/scoreInterim.js'
import { ScoreFinal } from '../actions/scoreFinal.js'

export const WebOfPowerActionSchemas = {
    ...WebOfPowerApiActions,
    [ActionType.RefillDisplay]: RefillDisplay,
    [ActionType.ScoreInterim]: ScoreInterim,
    [ActionType.ScoreFinal]: ScoreFinal
} satisfies Record<ActionType, Type.TSchema>
