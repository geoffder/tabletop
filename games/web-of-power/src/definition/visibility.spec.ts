import { describe, expect, it } from 'vitest'
import { assert, getPrng, type Visibility } from '@tabletop/common'
import { WebOfPowerRuntime } from './runtime.js'
import { ActionType } from './actions.js'
import { act, actionBase, createGame, execute, startGame } from './tests/playthrough.js'
import {
    HydratedWebOfPowerGameState,
    WebOfPowerGameStateValidator,
    type WebOfPowerGameState
} from '../model/gameState.js'
import { isDrawFromDeck } from '../actions/drawFromDeck.js'

function perspectives(state: WebOfPowerGameState): Visibility.Perspective[] {
    return [
        { kind: 'spectator' },
        ...state.turnManager.turnOrder.map((playerId) => ({ kind: 'player', playerId }) as const)
    ]
}

const isOwn = (perspective: Visibility.Perspective, playerId: string) =>
    perspective.kind === 'player' && perspective.playerId === playerId

function project(state: WebOfPowerGameState, perspective: Visibility.Perspective, config = {}) {
    return WebOfPowerRuntime.visibility.state.project(state, perspective, { config })
}

describe('what each Perspective sees', () => {
    it('shows each player only their own hand and nobody the deck, but everyone the rest', () => {
        const game = createGame()
        const state = startGame(game)
        for (const perspective of perspectives(state)) {
            const view = project(state, perspective, game.config)
            for (const player of view.players) {
                expect(player.hand !== undefined).toBe(isOwn(perspective, player.playerId))
                expect(player.handCount).toBe(3)
            }
            expect(view.deck.items).toEqual([])
            expect(view.deck.remaining).toBe(state.deck.remaining)
            expect(view.display).toEqual(state.display)
            expect(view.discard).toEqual(state.discard)
            expect(() => WebOfPowerRuntime.hydrator.hydrateState(view)).not.toThrow()
        }
    })

    it('shows the card drawn from the deck only to the player who drew it', () => {
        const game = createGame()
        const state = startGame(game)
        const [playerId] = state.activePlayerIds
        const [card] = state.players[0].hand
        const exchanged = act(game, state, ActionType.ExchangeCard, { card })
        const { processedActions } = execute(game, exchanged, {
            ...actionBase(game, playerId),
            type: ActionType.DrawFromDeck,
            revealsInfo: true
        })
        const draw = processedActions.find((action) => isDrawFromDeck(action))
        assert(draw !== undefined, 'The draw is recorded')
        for (const perspective of perspectives(state)) {
            const seen = WebOfPowerRuntime.visibility.actions.project(draw, perspective, {
                config: game.config
            })
            expect(seen.type).toBe(ActionType.DrawFromDeck)
            const metadata = (seen as { metadata?: { card?: string; exhausted: boolean } }).metadata
            expect(metadata?.card !== undefined).toBe(isOwn(perspective, playerId))
            expect(metadata?.exhausted).toBe(false)
        }
    })

    it("finds the acting player's choices from their own view", () => {
        const game = createGame()
        const state = startGame(game)
        const [playerId] = state.activePlayerIds
        const view = new HydratedWebOfPowerGameState(
            project(state, { kind: 'player', playerId }, game.config)
        )
        expect(view.canPlaceAnything(playerId, false)).toBe(true)
        const other = state.turnManager.turnOrder[1]
        expect(() => view.getPlayerState(other).knownHand()).toThrow()
    })
})

describe('exploring', () => {
    function populate(state: WebOfPowerGameState, perspective: Visibility.Perspective, seed = 3) {
        const game = createGame()
        return WebOfPowerRuntime.exploration.createFromProjectedState({
            game,
            state: project(state, perspective, game.config),
            actions: [],
            perspective,
            random: getPrng(seed)
        })
    }

    it('deals the unseen cards afresh, keeping what the explorer can see', () => {
        const game = createGame()
        const state = startGame(game)
        for (const perspective of perspectives(state)) {
            const sample = populate(state, perspective)
            assert(WebOfPowerGameStateValidator.Check(sample), 'The sample is complete')
            expect(sample.deck.remaining).toBe(state.deck.remaining)
            expect(sample.display).toEqual(state.display)
            for (const player of sample.players) {
                expect(player.hand).toHaveLength(3)
                if (isOwn(perspective, player.playerId)) {
                    expect(player.hand).toEqual(
                        state.players.find((p) => p.playerId === player.playerId)?.hand
                    )
                }
            }
            const all = [
                ...sample.deck.items,
                ...sample.display,
                ...sample.players.flatMap((p) => p.hand)
            ]
            expect(all.toSorted()).toEqual(
                [
                    ...state.deck.items,
                    ...state.display,
                    ...state.players.flatMap((p) => p.hand)
                ].toSorted()
            )
        }
    })

    it('samples the same way whatever the secrets were', () => {
        const game = createGame()
        const state = startGame(game)
        const other = startGame(game, 'fedcba9876543210fedcba9876543210')
        const perspective = { kind: 'player', playerId: state.activePlayerIds[0] } as const
        const sameView = structuredClone(other)
        sameView.players = sameView.players.map((player, index) => ({
            ...player,
            hand: isOwn(perspective, player.playerId) ? state.players[index].hand : player.hand
        }))
        sameView.display = state.display
        expect(populate(state, perspective)).toEqual(
            populate(sameViewWithDeck(sameView, state), perspective)
        )
    })
})

function sameViewWithDeck(view: WebOfPowerGameState, state: WebOfPowerGameState) {
    const result = structuredClone(state)
    result.deck = { items: [...state.deck.items].reverse(), remaining: state.deck.remaining }
    result.players = result.players.map((player, index) =>
        index === 0 ? player : { ...player, hand: view.players[index].hand }
    )
    return result
}
