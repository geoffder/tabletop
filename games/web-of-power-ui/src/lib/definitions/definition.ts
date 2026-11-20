import {
    gameClientCapabilities,
    type GameUiDefinition
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import { WebOfPowerInfo } from '@tabletop/web-of-power'
import type { HydratedWebOfPowerGameState, WebOfPowerProjectedState } from '@tabletop/web-of-power'
import coverImg from '$lib/images/web-of-power-cover.webp'

export const UiDefinition: GameUiDefinition<WebOfPowerProjectedState, HydratedWebOfPowerGameState> =
    {
        info: {
            ...WebOfPowerInfo,
            thumbnailUrl: coverImg,
            clientCapabilities: gameClientCapabilities()
        },
        runtime: async () => {
            return (await import('./runtime.js')).WebOfPowerUiRuntime
        }
    }
