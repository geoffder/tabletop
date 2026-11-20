import { DefaultStateLogger, type GameRuntime, Visibility } from '@tabletop/common'
import {
    WebOfPowerGameState,
    WebOfPowerGameStateValidator,
    type HydratedWebOfPowerGameState,
    type WebOfPowerProjectedState
} from '../model/gameState.js'
import { WebOfPowerHydrator } from './hydrator.js'
import { WebOfPowerGameInitializer } from './initializer.js'
import { WebOfPowerApiActions } from './apiActions.js'
import { WebOfPowerActionSchemas } from './actionSchemas.js'
import { WebOfPowerStateHandlers } from './stateHandlers.js'
import { WebOfPowerColors } from './colors.js'
import { WebOfPowerScoring } from './scoring.js'
import { WebOfPowerExploration } from './exploration.js'

export const WebOfPowerRuntime = {
    randomnessVersion: 1,
    initializer: new WebOfPowerGameInitializer(),
    exploration: new WebOfPowerExploration(),
    canonicalStateValidator: WebOfPowerGameStateValidator,
    hydrator: new WebOfPowerHydrator(),
    stateHandlers: WebOfPowerStateHandlers,
    apiActions: WebOfPowerApiActions,
    playerColors: WebOfPowerColors,
    stateLogger: new DefaultStateLogger(),
    scoring: new WebOfPowerScoring(),
    visibility: {
        state: Visibility.createProjector(WebOfPowerGameState),
        actions: Visibility.createActionProjector(WebOfPowerActionSchemas)
    }
} satisfies GameRuntime<WebOfPowerProjectedState, HydratedWebOfPowerGameState>
