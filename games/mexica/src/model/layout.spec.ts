import { describe, expect, it } from 'vitest'
import { chooseStarts, createGame, hydrate, startGame } from '../definition/tests/playthrough.js'
import { Axis, type Cell, LAND_CELLS } from './board.js'
import type { HydratedMexicaGameState } from './gameState.js'
import { Layout, type LayoutChange } from './layout.js'
import { DISTRICT_SIZES } from './pieces.js'

// A seeded run of positions from the opening on: canals, temples, bridges and walks, played on
// the state directly so the positions reach well past what a turn allows.
function* positions(games: number, steps: number) {
    let value = 11
    const random = () => (value = (value * 1103515245 + 12345) % 2 ** 31) / 2 ** 31
    const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)]
    for (let g = 0; g < games; g++) {
        const game = createGame(['a', 'b', 'c', 'd'])
        const state = hydrate(chooseStarts(game, startGame(game)))
        for (let n = 0; n < steps; n++) {
            const layout = state.layout()
            const open = LAND_CELLS.filter((cell) => state.canDigAt(cell, layout))
            if (open.length === 0) break
            const r = random()
            if (r < 0.55) state.dig([pick(open)])
            else if (r < 0.7) state.buildTemple('a', pick(open), 1)
            else if (r < 0.85) {
                const spans = [...layout.canals].flatMap((cell) =>
                    [Axis.NorthSouth, Axis.EastWest]
                        .filter((axis) => layout.bridgeFits(cell, axis))
                        .map((axis) => ({ cell, axis }))
                )
                if (spans.length > 0) {
                    const { cell, axis } = pick(spans)
                    state.buildBridge(cell, axis)
                }
            } else {
                const player = pick(state.players)
                const moves = [...state.moves(player.playerId).keys()]
                if (moves.length > 0) state.placePilli(player.playerId, pick(moves))
            }
            yield { state, pick }
        }
    }
}

// Every change one action could make here, each with the action played on a copy of the game.
function changes(
    state: HydratedMexicaGameState,
    pick: <T>(items: readonly T[]) => T
): { change: LayoutChange; play: (s: HydratedMexicaGameState) => void }[] {
    const layout = state.layout()
    const open = LAND_CELLS.filter((cell) => state.canDigAt(cell, layout))
    const cell = pick(open)
    const pairs = open.filter((other) => layout.districtOf(other) === layout.districtOf(cell))
    const second = pick(pairs)
    const mover = pick(state.players).playerId
    const found: ReturnType<typeof changes> = [
        { change: { dug: [cell] }, play: (s) => s.dig([cell]) },
        { change: { dug: [cell, second] }, play: (s) => s.dig([cell, second]) },
        {
            change: { temple: { cell, level: 2, playerId: 'b' } },
            play: (s) => s.buildTemple('b', cell, 2)
        },
        {
            change: { pilli: { playerId: mover, cell } },
            play: (s) => s.placePilli(mover, cell)
        }
    ]
    if (state.bridges.length > 0) {
        const bridge = pick(state.bridges)
        const spans = [...layout.canals].flatMap((at) =>
            [Axis.NorthSouth, Axis.EastWest]
                .filter((axis) => layout.bridgeFits(at, axis))
                .map((axis) => ({ cell: at, axis }))
        )
        if (spans.length > 0) {
            const to = pick(spans)
            found.push({
                change: { bridge: { from: bridge.cell, to } },
                play: (s) => s.moveBridge(bridge.cell, to.cell, to.axis)
            })
        }
    }
    // A founding, with a token of the district's size put on display for it.
    const district = layout.districtOf(state.pilliOf(mover))
    const tokenId = DISTRICT_SIZES.indexOf(district?.length ?? 0)
    if (district !== undefined && tokenId >= 0 && layout.tokenIn(district) === undefined) {
        state.display = [tokenId]
        const spot = district.find((at) => layout.isBuildable(at))
        if (spot !== undefined) {
            found.push({
                change: state.foundingChange(mover, spot),
                play: (s) => s.found(mover, spot)
            })
        }
    }
    return found
}

function contents(layout: Layout) {
    return {
        canals: [...layout.canals].sort((a, b) => a - b),
        bridges: [...layout.bridges].sort(([a], [b]) => a - b),
        temples: [...layout.temples].sort(([a], [b]) => a - b),
        tokens: [...layout.tokens].sort(([a], [b]) => a - b),
        pillis: [...layout.pillis].sort(([a], [b]) => a - b),
        districts: layout
            .districts()
            .map((district) => district.join(','))
            .sort(),
        districtOf: LAND_CELLS.map((cell: Cell) => layout.districtOf(cell)?.join(','))
    }
}

describe('a change laid over a layout', () => {
    it('gives the layout the action leaves, districts and all', () => {
        let compared = 0
        const kinds = new Set<string>()
        for (const { state, pick } of positions(12, 50)) {
            for (const { change, play } of changes(state, pick)) {
                const played = hydrate(structuredClone(state.dehydrate()))
                play(played)
                expect(contents(state.layout().after(change))).toEqual(contents(played.layout()))
                compared++
                kinds.add(Object.keys(change).join())
            }
        }
        expect(compared).toBeGreaterThan(2000)
        expect([...kinds].sort()).toEqual(['bridge', 'dug', 'pilli', 'temple', 'token'])
    })

    it('frees and shuts in the Pilli Mexica as the action played out would', () => {
        let shutIn = 0
        for (const { state, pick } of positions(12, 50)) {
            const layout = state.layout()
            for (const { change, play } of changes(state, pick)) {
                const played = hydrate(structuredClone(state.dehydrate()))
                play(played)
                for (const { playerId } of state.players) {
                    if (change.pilli?.playerId === playerId) continue
                    const free = played.isFree(playerId)
                    expect(state.isFree(playerId, layout.after(change))).toBe(free)
                    if (!free) shutIn++
                }
            }
        }
        expect(shutIn).toBeGreaterThan(50)
    })

    it('finds the squares a district hangs together through', () => {
        let cuts = 0
        for (const { state } of positions(4, 40)) {
            const layout = state.layout()
            for (const cell of LAND_CELLS) {
                const district = layout.districtOf(cell)
                if (district === undefined) continue
                const after = new Layout({
                    ...state,
                    canals: [...state.canals, { cells: [cell] }],
                    pillis: []
                })
                const splits =
                    district.length > 1 && after.districts().length > layout.districts().length
                expect(layout.isCutSquare(cell), `square ${cell}`).toBe(splits)
                if (splits) cuts++
            }
        }
        expect(cuts).toBeGreaterThan(100)
    })
})
