import { DefaultStateLogger, type GameRuntime } from '@tabletop/common'
import {
    HomeworldsGameStateValidator,
    type HydratedHomeworldsGameState,
    type HomeworldsGameState
} from '../model/gameState.js'
import { HomeworldsHydrator } from './hydrator.js'
import { HomeworldsGameInitializer } from './initializer.js'
import { HomeworldsApiActions } from './apiActions.js'
import { HomeworldsStateHandlers } from './stateHandlers.js'
import { HomeworldsColors } from './colors.js'
import { HomeworldsScoring } from './scoring.js'

export const HomeworldsRuntime: GameRuntime<HomeworldsGameState, HydratedHomeworldsGameState> = {
    randomnessVersion: 1,
    initializer: new HomeworldsGameInitializer(),
    canonicalStateValidator: HomeworldsGameStateValidator,
    hydrator: new HomeworldsHydrator(),
    stateHandlers: HomeworldsStateHandlers,
    apiActions: HomeworldsApiActions,
    playerColors: HomeworldsColors,
    stateLogger: new DefaultStateLogger(),
    scoring: new HomeworldsScoring()
}
