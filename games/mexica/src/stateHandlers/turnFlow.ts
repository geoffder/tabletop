import { assertExists } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import type { HydratedMexicaGameState } from '../model/gameState.js'

export function turnHolder(state: HydratedMexicaGameState): string {
    const turn = state.turnManager.currentTurn()
    assertExists(turn, 'A player must have the turn')
    return turn.playerId
}

// A period ends once its conditions hold and the round is played out, so everyone has had as many
// turns; or at once after a full round in which nobody did anything.
export function endTurn(state: HydratedMexicaGameState): MachineState {
    const playerId = turnHolder(state)
    state.idleTurns = state.acted ? 0 : state.idleTurns + 1
    state.turnManager.endTurn(state.actionCount)
    if (state.idleTurns >= state.players.length) return MachineState.PeriodScoring
    const next = state.turnManager.nextPlayer(playerId)
    if (state.periodComplete() && next === state.turnManager.turnOrder[0]) {
        return MachineState.PeriodScoring
    }
    state.turnManager.startNextTurn(state.actionCount)
    state.startTurn()
    return MachineState.Acting
}

// Each period starts with the first player.
export function startPeriod(state: HydratedMexicaGameState): MachineState {
    state.turnManager.startTurn(state.turnManager.turnOrder[0], state.actionCount)
    state.startTurn()
    return MachineState.Acting
}
