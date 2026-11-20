import type {
    GameUIRuntime,
    PlayerColorPalette
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import { Color } from '@tabletop/common'
import type { HydratedWebOfPowerGameState, WebOfPowerProjectedState } from '@tabletop/web-of-power'
import { WebOfPowerRuntime } from '@tabletop/web-of-power'
import { mountDynamicComponent } from '@tabletop/frontend-components/utils/dynamicComponent'
import { WebOfPowerGameColorizer } from './colorizer.js'
import GameTable from '../components/GameTable.svelte'
import { WebOfPowerGameSession } from '$lib/model/session.svelte.js'
import '../../app.css'

// Deep, saturated piece colours, so each player's pieces stand out on the map's pale countries.
const webOfPowerPlayerColorPalette: PlayerColorPalette = {
    [Color.White]: { fill: '#f1eee6', text: '#1b1c1f', contrast: '#1b1c1f' },
    [Color.Black]: { fill: '#222124', text: '#f2efe8', contrast: '#f2efe8' },
    [Color.Red]: { fill: '#c1272d', text: '#ffffff', contrast: '#ffffff' },
    [Color.Orange]: { fill: '#e8741c', text: '#ffffff', contrast: '#ffffff' },
    [Color.Yellow]: { fill: '#f4c430', text: '#1b1b1b', contrast: '#1b1b1b' },
    [Color.Green]: { fill: '#23843f', text: '#ffffff', contrast: '#ffffff' },
    [Color.Blue]: { fill: '#2558b5', text: '#ffffff', contrast: '#ffffff' },
    [Color.Purple]: { fill: '#743f9c', text: '#ffffff', contrast: '#ffffff' },
    [Color.Pink]: { fill: '#e2589f', text: '#ffffff', contrast: '#ffffff' },
    [Color.Brown]: { fill: '#8a5228', text: '#ffffff', contrast: '#ffffff' },
    [Color.Gray]: { fill: '#8f989b', text: '#111111', contrast: '#111111' }
}

export const WebOfPowerUiRuntime: GameUIRuntime<
    WebOfPowerProjectedState,
    HydratedWebOfPowerGameState
> = {
    ...WebOfPowerRuntime,
    gameUI: {
        component: GameTable,
        load: async () => GameTable,
        mount: mountDynamicComponent
    },
    sessionClass: WebOfPowerGameSession,
    colorizer: new WebOfPowerGameColorizer(),
    playerColorPalette: webOfPowerPlayerColorPalette
}
