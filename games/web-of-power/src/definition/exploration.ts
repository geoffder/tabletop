import { assert, type ExplorationPopulation, type GameExploration, shuffle } from '@tabletop/common'
import {
    HydratedWebOfPowerGameState,
    WebOfPowerGameStateValidator,
    type WebOfPowerGameState,
    type WebOfPowerProjectedState
} from '../model/gameState.js'
import { deckFor } from '../model/map.js'

export class WebOfPowerExploration implements GameExploration<WebOfPowerProjectedState> {
    createFromCanonicalState(state: WebOfPowerProjectedState): WebOfPowerProjectedState {
        const hydrated = new HydratedWebOfPowerGameState(structuredClone(state))
        hydrated.deck.shuffle(hydrated.getProtectedPrng().random)
        return hydrated.dehydrate()
    }

    // Cards the explorer cannot see are dealt afresh from those not shown anywhere: the deck and the
    // other players' hands. Face-up cards, the discard pile and the explorer's own hand are known.
    createFromProjectedState({
        state,
        random
    }: ExplorationPopulation<WebOfPowerProjectedState>): WebOfPowerGameState {
        const unseen = deckFor(state.players.length)
        const known = [
            ...state.display,
            ...state.discard,
            ...state.players.flatMap((player) => player.hand ?? [])
        ]
        for (const card of known) {
            const index = unseen.indexOf(card)
            assert(index >= 0, 'The known cards must come from the deck')
            unseen.splice(index, 1)
        }
        shuffle(unseen, random)
        const result = structuredClone(state)
        for (const player of result.players) {
            if (player.hand === undefined) player.hand = unseen.splice(0, player.handCount)
        }
        result.deck = { items: unseen, remaining: unseen.length }
        assert(result.deck.remaining === state.deck.remaining, 'Unseen cards must fill the deck')
        assert(WebOfPowerGameStateValidator.Check(result), 'Exploration needs complete state')
        return result
    }
}
