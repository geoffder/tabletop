import { describe, expect, it } from 'vitest'
import { assert, validateGameResult } from '@tabletop/common'
import { WebOfPowerRuntime } from './runtime.js'
import { ActionType } from './actions.js'
import { WebOfPowerGameStateValidator, type WebOfPowerGameState } from '../model/gameState.js'
import {
    createGame,
    engine,
    legalActions,
    execute,
    MASTER_SEED,
    playToEnd,
    startGame
} from './tests/playthrough.js'

const SEATS = ['p1', 'p2', 'p3', 'p4']
const orders = [SEATS, ['p3', 'p1', 'p4', 'p2']]

function rename(state: WebOfPowerGameState, mapping: Record<string, string>): WebOfPowerGameState {
    return JSON.parse(
        JSON.stringify(state).replace(/"p[1-4]"/g, (id) => `"${mapping[id.slice(1, -1)]}"`)
    )
}

describe.each([{}, { fasterVariant: true }])('Web of Power tournaments %o', (config) => {
    it('starts the player in seat one, then seat two', () => {
        const game = createGame(config, SEATS)
        for (const order of orders) {
            const initialState = startGame(game, MASTER_SEED, order)
            expect(initialState.turnManager.turnOrder).toEqual(order)
            expect(initialState.activePlayerIds).toEqual([order[0]])
            assert(WebOfPowerGameStateValidator.Check(initialState), 'Setup is canonical')
            const exchange = legalActions(game, initialState).find(
                (action) => action.type === ActionType.ExchangeCard
            )
            assert(exchange !== undefined, 'The first player may exchange')
            const exchanged = execute(game, initialState, exchange).updatedState
            const draw = legalActions(game, exchanged).at(-1)
            assert(draw !== undefined, 'The player may draw')
            const state = execute(game, exchanged, draw).updatedState
            expect(state.activePlayerIds).toEqual([order[1]])
        }
    })

    it('leaves the seeded setup unchanged apart from who sits where', () => {
        const game = createGame(config, SEATS)
        const uninitialized = engine.generateUninitializedState(game, MASTER_SEED)
        const initialize = (playerIds: string[]) =>
            WebOfPowerRuntime.initializer
                .initializeGameState(game, structuredClone(uninitialized), { playerIds })
                .dehydrate()
        const reference = initialize(orders[0])
        const assigned = initialize(orders[1])
        assert(WebOfPowerGameStateValidator.Check(reference), 'Setup must be canonical')
        assert(WebOfPowerGameStateValidator.Check(assigned), 'Setup must be canonical')
        const mapping = Object.fromEntries(orders[1].map((id, index) => [orders[0][index], id]))
        expect(JSON.parse(JSON.stringify(assigned))).toEqual(rename(reference, mapping))
    })

    it('finishes an assigned game with a valid result and its points as scores', () => {
        const game = createGame(config, SEATS)
        const initialState = startGame(game, MASTER_SEED, orders[1])
        const finished = playToEnd(game, initialState, 7)
        assert(WebOfPowerGameStateValidator.Check(finished), 'The finished state is canonical')
        expect(() => validateGameResult(finished)).not.toThrow()
        expect(WebOfPowerRuntime.scoring.finalScores(finished)).toEqual(
            Object.fromEntries(finished.players.map((player) => [player.playerId, player.score]))
        )
    })
})
