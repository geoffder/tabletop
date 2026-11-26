import {
    gameClientCapabilities,
    type GameUiDefinition
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import { HomeworldsInfo } from '@tabletop/homeworlds'
import type { HomeworldsGameState, HydratedHomeworldsGameState } from '@tabletop/homeworlds'
import coverImg from '$lib/images/homeworlds-cover.webp'

export const UiDefinition: GameUiDefinition<HomeworldsGameState, HydratedHomeworldsGameState> = {
    info: {
        ...HomeworldsInfo,
        thumbnailUrl: coverImg,
        clientCapabilities: gameClientCapabilities()
    },
    runtime: async () => {
        return (await import('./runtime.js')).HomeworldsUiRuntime
    }
}
