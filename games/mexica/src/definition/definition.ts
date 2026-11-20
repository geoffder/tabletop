import { defineGame } from '@tabletop/common'
import type { HydratedMexicaGameState, MexicaGameState } from '../model/gameState.js'
import { MexicaInfo } from './info.js'
import { MexicaRuntime } from './runtime.js'

export const Definition = defineGame<MexicaGameState, HydratedMexicaGameState>({
    info: MexicaInfo,
    runtime: MexicaRuntime
})
