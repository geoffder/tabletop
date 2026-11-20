import {
    gameClientCapabilities,
    type GameUiDefinition
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import { MexicaInfo } from '@tabletop/mexica'
import type { HydratedMexicaGameState, MexicaGameState } from '@tabletop/mexica'
import coverImg from '$lib/images/mexica-cover.webp'

export const UiDefinition: GameUiDefinition<MexicaGameState, HydratedMexicaGameState> = {
    info: {
        ...MexicaInfo,
        thumbnailUrl: coverImg,
        clientCapabilities: gameClientCapabilities()
    },
    runtime: async () => {
        return (await import('./runtime.js')).MexicaUiRuntime
    }
}
