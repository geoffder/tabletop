import { describe, expect, it } from 'vitest'
import { assert, validateGameResult } from '@tabletop/common'
import { MexicaRuntime } from './runtime.js'
import { MachineState } from './states.js'
import { MexicaGameStateValidator, type MexicaGameState } from '../model/gameState.js'
import { createGame, engine, MASTER_SEED, playToEnd } from './tests/playthrough.js'

const SEATS = ['p1', 'p2', 'p3', 'p4']

// The same position with the players exchanged as `order` sits them in place of `reference`.
function reseat(state: MexicaGameState, from: string[], to: string[]): MexicaGameState {
    const text = JSON.stringify(state).replace(/"p[1-4]"/g, (id) => {
        const index = from.indexOf(id.slice(1, -1))
        return `"${to[index]}"`
    })
    return JSON.parse(text)
}

describe.each([2, 3, 4])('Mexica tournaments with %i players', (count) => {
    const players = SEATS.slice(0, count)
    const orders = [players, [...players].reverse()]

    it('starts the player in seat one', () => {
        const game = createGame(players)
        for (const order of orders) {
            const { initialState } = engine.startGame(game, {
                masterSeed: MASTER_SEED,
                startingPositions: { playerIds: order }
            })
            expect(initialState.turnManager.turnOrder).toEqual(order)
            expect(initialState.machineState).toBe(MachineState.ChoosingStart)
            expect(initialState.activePlayerIds).toEqual([order[0]])
        }
    })

    it('leaves the seeded setup unchanged apart from who sits where', () => {
        const game = createGame(players)
        const uninitialized = engine.generateUninitializedState(game, MASTER_SEED)
        const initialize = (playerIds: string[]) =>
            MexicaRuntime.initializer
                .initializeGameState(game, structuredClone(uninitialized), { playerIds })
                .dehydrate()
        const reference = initialize(orders[0])
        for (const order of orders) {
            const assigned = initialize(order)
            assert(MexicaGameStateValidator.Check(assigned), 'Setup must be canonical')
            expect(assigned.turnManager.turnOrder).toEqual(order)
            expect(assigned).toEqual(reseat(reference, orders[0], order))
        }
    })

    it('finishes an assigned game with a valid result and the prestige as scores', () => {
        const game = createGame(players)
        const { initialState } = engine.startGame(game, {
            masterSeed: MASTER_SEED,
            startingPositions: { playerIds: orders[1] }
        })
        const finished = playToEnd(game, initialState, 7)
        assert(MexicaGameStateValidator.Check(finished), 'The finished state must be canonical')
        expect(() => validateGameResult(finished)).not.toThrow()
        expect(MexicaRuntime.scoring?.finalScores(finished)).toEqual(
            Object.fromEntries(finished.players.map((player) => [player.playerId, player.score]))
        )
    })

    it('plays the same game from the same seed', () => {
        const game = createGame(players)
        const play = () => playToEnd(game, engine.startGame(game, MASTER_SEED).initialState, 3)
        const first = play()
        const second = play()
        expect(second.players).toEqual(first.players)
        expect(second.temples).toEqual(first.temples)
    })
})
