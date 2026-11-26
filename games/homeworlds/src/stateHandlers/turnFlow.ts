import { assertExists, type HydratedAction } from '@tabletop/common'
import { EndReason, HydratedHomeworldsGameState } from '../model/gameState.js'
import { MachineState } from '../definition/states.js'
import { HydratedBuild, isBuild } from '../actions/build.js'
import { HydratedMove, isMove } from '../actions/move.js'
import { HydratedDiscover, isDiscover } from '../actions/discover.js'
import { HydratedCapture, isCapture } from '../actions/capture.js'
import { HydratedTrade, isTrade } from '../actions/trade.js'

export type PowerAction =
    HydratedBuild | HydratedMove | HydratedDiscover | HydratedCapture | HydratedTrade

export function isPowerAction(action: HydratedAction): action is PowerAction {
    return (
        isBuild(action) ||
        isMove(action) ||
        isDiscover(action) ||
        isCapture(action) ||
        isTrade(action)
    )
}

export function turnHolder(state: HydratedHomeworldsGameState): string {
    const turn = state.turnManager.currentTurn()
    assertExists(turn, 'Every action is taken during a turn')
    return turn.playerId
}

type TurnAction = HydratedAction & { metadata?: { turnEnded?: boolean } }

// The turn ends by itself once nothing optional is left: no action of a sacrifice still to use
// and no catastrophe to declare. It never ends by itself with the player out of their homeworld,
// which would lose the game; ending it then takes the End turn action.
export function continueTurn(
    action: TurnAction,
    state: HydratedHomeworldsGameState,
    next: MachineState.TakingTurn | MachineState.SacrificeActions | MachineState.FinishingTurn,
    actionCount: number
): MachineState {
    const playerId = turnHolder(state)
    if (next === MachineState.TakingTurn) return next
    if (next === MachineState.SacrificeActions && state.hasPowerUse(playerId)) return next
    if (state.hasCatastrophe() || state.isOut(playerId)) return next
    assertExists(action.metadata, 'An action in a turn records what it did')
    action.metadata.turnEnded = true
    return endTurn(state, actionCount)
}

// At the end of every turn a player whose homeworld is gone, or has none of their ships, is out;
// both out at once is a draw. The third time a position comes round is a draw too.
export function endTurn(state: HydratedHomeworldsGameState, actionCount: number): MachineState {
    state.sacrifice = undefined
    state.turnManager.endTurn(actionCount)
    const out = state.players.filter((player) => state.isOut(player.playerId))
    if (out.length === state.players.length) {
        state.declareDraw(EndReason.BothEliminated)
        return MachineState.EndOfGame
    }
    const [loser] = out
    if (loser !== undefined) {
        state.declareWinner(state.opponentOf(loser.playerId))
        return MachineState.EndOfGame
    }
    const next = state.turnManager.startNextTurn(actionCount)
    if (state.recordPosition(next)) {
        state.declareDraw(EndReason.Repetition)
        return MachineState.EndOfGame
    }
    return MachineState.TakingTurn
}
