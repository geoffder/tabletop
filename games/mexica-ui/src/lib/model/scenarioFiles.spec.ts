// @vitest-environment node
// Only game logic: the client runes environment lacks globals the logic package loads with.
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import type { GameAction } from '@tabletop/common'
import {
    areAdjacent,
    BOARD_WIDTH,
    HydratedMexicaGameState,
    type MexicaGameState,
    MexicaGameStateValidator,
    tokenSize
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

    it.each(['jump-over', 'jump-into-canoe'])(
        '%s rides under a bridge another Pilli Mexica stands on',
        (name) => {
            const state = scenario(name)
            const [playerId] = state.activePlayerIds
            const layout = state.layout()
            const ap = state.apAvailable(playerId)
            const others = new Set(
                state.players
                    .filter((player) => player.playerId !== playerId)
                    .map((player) => player.pilli)
            )
            const under = [...state.moves(playerId).values()]
                .filter((move) => !move.teleport && move.cost <= ap)
                .flatMap((move) => move.path.slice(1, -1))
                .filter((cell) => layout.bridges.has(cell) && others.has(cell))
            expect(under.length).toBeGreaterThan(0)
            expect(state.moves(playerId).has(under[0])).toBe(false)
        }
    )

    it('Pilli cover stands two players on bridges in front of a level-1 temple and a token', () => {
        const state = scenario('pilli-cover')
        const layout = state.layout()
        const behind = (cell: number) => cell - BOARD_WIDTH
        const standing = state.players
            .filter((player) => !state.activePlayerIds.includes(player.playerId))
            .map((player) => player.pilli)
            .filter((cell): cell is number => cell !== undefined && layout.bridges.has(cell))
        const lowTemple = standing.some((cell) =>
            state.temples.some((temple) => temple.cell === behind(cell) && temple.level === 1)
        )
        const token = standing.some((cell) =>
            state.districts.some((district) => district.cell === behind(cell))
        )
        expect(lowTemple).toBe(true)
        expect(token).toBe(true)
    })

    it('Ruled out loses both 4s from the display once Carol builds a 3-level temple at F1', () => {
        const state = scenario('ruled-out')
        const [playerId] = state.activePlayerIds
        const f1 = 5
        expect(state.impossibleTokens()).toEqual([])
        expect(state.display.map((tokenId) => tokenSize(tokenId))).toEqual([4, 4])
        expect(state.canBuildTemple(playerId, f1, 3)).toBe(true)
        state.buildTemple(playerId, f1, 3)
        expect(state.impossibleTokens()).toEqual(state.display)
    })

    it.each([
        ['first-scoring', 1],
        ['final-scoring', 2]
    ])('%s ends period %i when its last player ends the turn', (name, period) => {
        const state = scenario(name)
        expect(state.period).toBe(period)
        expect(state.periodComplete()).toBe(true)
        expect(state.activePlayerIds).toEqual([state.turnManager.turnOrder.at(-1)])
    })
})
