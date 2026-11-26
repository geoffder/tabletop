import type { HydratedAction, MachineStateHandler } from '@tabletop/common'
import { MachineState } from './states.js'
import type { HydratedHomeworldsGameState } from '../model/gameState.js'
import { SettingUpStateHandler } from '../stateHandlers/settingUp.js'
import { TakingTurnStateHandler } from '../stateHandlers/takingTurn.js'
import { SacrificeActionsStateHandler } from '../stateHandlers/sacrificeActions.js'
import { FinishingTurnStateHandler } from '../stateHandlers/finishingTurn.js'
import { EndOfGameStateHandler } from '../stateHandlers/endOfGame.js'

export const HomeworldsStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedHomeworldsGameState>
> = {
    [MachineState.SettingUp]: new SettingUpStateHandler(),
    [MachineState.TakingTurn]: new TakingTurnStateHandler(),
    [MachineState.SacrificeActions]: new SacrificeActionsStateHandler(),
    [MachineState.FinishingTurn]: new FinishingTurnStateHandler(),
    [MachineState.EndOfGame]: new EndOfGameStateHandler()
}
