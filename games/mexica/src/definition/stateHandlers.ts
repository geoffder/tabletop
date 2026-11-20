import type { HydratedAction, MachineStateHandler } from '@tabletop/common'
import { MachineState } from './states.js'
import type { HydratedMexicaGameState } from '../model/gameState.js'
import { ChoosingStartStateHandler } from '../stateHandlers/choosingStart.js'
import { ActingStateHandler } from '../stateHandlers/acting.js'
import { PeriodScoringStateHandler } from '../stateHandlers/periodScoring.js'
import { EndOfGameStateHandler } from '../stateHandlers/endOfGame.js'

export const MexicaStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedMexicaGameState>
> = {
    [MachineState.ChoosingStart]: new ChoosingStartStateHandler(),
    [MachineState.Acting]: new ActingStateHandler(),
    [MachineState.PeriodScoring]: new PeriodScoringStateHandler(),
    [MachineState.EndOfGame]: new EndOfGameStateHandler()
}
