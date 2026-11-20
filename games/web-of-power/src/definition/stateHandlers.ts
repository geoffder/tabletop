import type { HydratedAction, MachineStateHandler } from '@tabletop/common'
import { MachineState } from './states.js'
import type { HydratedWebOfPowerGameState } from '../model/gameState.js'
import { PlacingPiecesStateHandler } from '../stateHandlers/placingPieces.js'
import { DrawingStateHandler } from '../stateHandlers/drawing.js'
import { RefillingDisplayStateHandler } from '../stateHandlers/refillingDisplay.js'
import { InterimScoringStateHandler } from '../stateHandlers/interimScoring.js'
import { FinalScoringStateHandler } from '../stateHandlers/finalScoring.js'
import { EndOfGameStateHandler } from '../stateHandlers/endOfGame.js'

export const WebOfPowerStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedWebOfPowerGameState>
> = {
    [MachineState.PlacingPieces]: new PlacingPiecesStateHandler(),
    [MachineState.Drawing]: new DrawingStateHandler(),
    [MachineState.RefillingDisplay]: new RefillingDisplayStateHandler(),
    [MachineState.InterimScoring]: new InterimScoringStateHandler(),
    [MachineState.FinalScoring]: new FinalScoringStateHandler(),
    [MachineState.EndOfGame]: new EndOfGameStateHandler()
}
