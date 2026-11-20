import type { GameProgress, GameProgression } from '@tabletop/common'
import type { MexicaGameState } from '../model/gameState.js'
import { DISTRICT_SIZES, PERIODS } from '../model/pieces.js'

export class MexicaProgression implements GameProgression<MexicaGameState> {
    progress(state: MexicaGameState): GameProgress {
        const left = state.display.length + state.reserve.length
        const fraction =
            state.result === undefined ? (DISTRICT_SIZES.length - left) / DISTRICT_SIZES.length : 1
        const last = state.period === PERIODS
        return {
            fraction,
            label: `Period ${state.period} · ${state.display.length} districts to found`,
            ...(last ? { final: true } : {})
        }
    }
}
