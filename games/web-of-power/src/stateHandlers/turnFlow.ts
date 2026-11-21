import { assertExists } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import type { HydratedWebOfPowerGameState } from '../model/gameState.js'

export function turnHolder(state: HydratedWebOfPowerGameState): string {
    const turn = state.turnManager.currentTurn()
    assertExists(turn, 'A player must have the turn')
    return turn.playerId
}

export function afterPlacing(state: HydratedWebOfPowerGameState): MachineState {
    if (!state.anyPieceCanGoDown()) return finalScoring(state)
    return state.canDraw() ? MachineState.Drawing : finishTurn(state)
}

export function afterDrawing(state: HydratedWebOfPowerGameState): MachineState {
    const player = state.getPlayerState(turnHolder(state))
    if (player.handCount < 3 && state.canDraw()) return MachineState.Drawing
    return state.displayNeedsCards() ? MachineState.RefillingDisplay : finishTurn(state)
}

export function afterExhaustion(state: HydratedWebOfPowerGameState): MachineState {
    return state.isFinalRound() ? finishTurn(state) : MachineState.InterimScoring
}

// In the last round the game ends after the player before the starting player.
export function finishTurn(state: HydratedWebOfPowerGameState): MachineState {
    const playerId = turnHolder(state)
    state.placements = []
    state.turnManager.endTurn(state.actionCount)
    if (!state.anyPieceCanGoDown()) return finalScoring(state)
    if (state.isFinalRound() && playerId === state.turnManager.turnOrder.at(-1)) {
        return finalScoring(state)
    }
    state.turnManager.startNextTurn(state.actionCount)
    return MachineState.PlacingPieces
}

function finalScoring(state: HydratedWebOfPowerGameState): MachineState {
    if (state.turnManager.currentTurn() !== undefined) state.turnManager.endTurn(state.actionCount)
    state.placements = []
    state.activePlayerIds = []
    return MachineState.FinalScoring
}
