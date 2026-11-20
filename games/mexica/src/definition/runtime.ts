import { DefaultStateLogger, type GameRuntime } from '@tabletop/common'
import {
    MexicaGameStateValidator,
    type HydratedMexicaGameState,
    type MexicaGameState
} from '../model/gameState.js'
import { MexicaHydrator } from './hydrator.js'
import { MexicaGameInitializer } from './initializer.js'
import { MexicaApiActions } from './apiActions.js'
import { MexicaStateHandlers } from './stateHandlers.js'
import { MexicaColors } from './colors.js'
import { MexicaScoring } from './scoring.js'
import { MexicaProgression } from './progression.js'

export const MexicaRuntime: GameRuntime<MexicaGameState, HydratedMexicaGameState> = {
    randomnessVersion: 1,
    initializer: new MexicaGameInitializer(),
    canonicalStateValidator: MexicaGameStateValidator,
    hydrator: new MexicaHydrator(),
    stateHandlers: MexicaStateHandlers,
    apiActions: MexicaApiActions,
    playerColors: MexicaColors,
    stateLogger: new DefaultStateLogger(),
    scoring: new MexicaScoring(),
    progression: new MexicaProgression()
}
