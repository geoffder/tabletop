// @vitest-environment node
// Only game logic: the client runes environment lacks globals the logic package loads with.
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import type { GameAction } from '@tabletop/common'
import {
    areAdjacent,
    HydratedMexicaGameState,
    type MexicaGameState,
    MexicaGameStateValidator
} from '@tabletop/mexica'

const FOLDER = new URL('../../scenarios/', import.meta.url)

interface ScenarioFile {
    game: { id: string }
    state: MexicaGameState
    actions: GameAction[]
}

const scenarios: [string, ScenarioFile][] = readdirSync(FOLDER)
    .filter((name) => name.endsWith('.json'))
    .map((name) => [name, JSON.parse(readFileSync(new URL(name, FOLDER), 'utf8'))])

const scenario = (name: string) => {
    const found = scenarios.find(([file]) => file === `${name}.json`)
    if (found === undefined) throw new Error(`No scenario ${name}`)
    return new HydratedMexicaGameState(structuredClone(found[1].state))
}

describe('the scenarios the harness offers', () => {
    it.each(scenarios)(
        '%s holds a valid state of its own game',
        (name, { game, state, actions }) => {
            expect(MexicaGameStateValidator.Check(state)).toBe(true)
            expect(game.id).toBe(`scenario-${name.replace(/\.json$/, '')}`)
            expect(state.gameId).toBe(game.id)
            expect(actions.every((action) => action.gameId === game.id)).toBe(true)
        }
    )

    it('Founding lets three players in turn found where they stand', () => {
        const state = scenario('founding')
        const order = state.turnManager.turnOrder
        const first = order.indexOf(state.activePlayerIds[0])
        const turns = order.map((_, index) => order[(first + index) % order.length])
        for (const playerId of turns.slice(0, 3)) {
            const layout = state.layout()
            expect(state.foundingToken(playerId, layout)).toBeDefined()
            const district = state.pilliDistrict(playerId, layout) ?? []
            const cell = district.find((square) => state.canFound(playerId, square, layout))
            expect(cell).toBeDefined()
            state.found(playerId, cell ?? 0)
        }
    })

    it('Canal rides reaches a bridge beside it and others by boat', () => {
        const state = scenario('canal-rides')
        const [playerId] = state.activePlayerIds
        const layout = state.layout()
        const ap = state.apAvailable(playerId)
        const legs = [...state.moves(playerId).values()]
            .filter((move) => !move.teleport && move.cost <= ap)
            .flatMap((move) =>
                move.path.slice(1).map((cell, index) => [move.path[index], cell] as const)
            )
            .filter(([from, to]) => layout.bridges.has(from) && layout.bridges.has(to))
        expect(legs.some(([from, to]) => areAdjacent(from, to))).toBe(true)
        expect(legs.filter(([from, to]) => !areAdjacent(from, to)).length).toBeGreaterThan(2)
    })
})
