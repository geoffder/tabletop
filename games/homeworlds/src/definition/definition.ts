import { defineGame } from '@tabletop/common'
import type { HydratedHomeworldsGameState, HomeworldsGameState } from '../model/gameState.js'
import { HomeworldsInfo } from './info.js'
import { HomeworldsRuntime } from './runtime.js'

export const Definition = defineGame<HomeworldsGameState, HydratedHomeworldsGameState>({
    info: HomeworldsInfo,
    runtime: HomeworldsRuntime
})
