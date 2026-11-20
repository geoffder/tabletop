import { defineGame } from '@tabletop/common'
import type { HydratedWebOfPowerGameState, WebOfPowerProjectedState } from '../model/gameState.js'
import { WebOfPowerInfo } from './info.js'
import { WebOfPowerRuntime } from './runtime.js'

export const Definition = defineGame<WebOfPowerProjectedState, HydratedWebOfPowerGameState>({
    info: WebOfPowerInfo,
    runtime: WebOfPowerRuntime
})
