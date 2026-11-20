// Writes the positions the dev harness offers under Scenarios, one file each in ../src/scenarios.
// Build the logic package first: node scripts/build-scenarios.mjs
import { readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ActionSource, defaultGameConfig, GameEngine, PlayerStatus } from '@tabletop/common'
import { startingPositionFile } from '@tabletop/common/testing'
import {
    ActionType,
    areAdjacent,
    Axis,
    Definition,
    HydratedMexicaGameState,
    LAND_CELLS,
    LEVELS,
    MachineState,
    MexicaInfo,
    MexicaRuntime,
    neighbours,
    START_CELLS,
    tokenSize
} from '@tabletop/mexica'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'scenarios')
const engine = new GameEngine(MexicaRuntime)
const NAMES = ['Alice', 'Bob', 'Carol', 'Dan']
const MASTER_SEED = '0123456789abcdef0123456789abcdef'

function start(count, config = {}) {
    const ids = NAMES.slice(0, count).map((_, index) => `player-${index + 1}`)
    const game = MexicaRuntime.initializer.initializeGame(
        {
            id: 'scenario',
            typeId: 'mexica',
            ownerId: 'owner',
            config: {
                ...defaultGameConfig(MexicaInfo.configurator?.options ?? []),
                ...config
            },
            players: ids.map((id, index) => ({
                id,
                name: NAMES[index],
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
    const { startedGame, initialState } = engine.startGame(game, {
        masterSeed: MASTER_SEED,
        startingPositions: { playerIds: ids }
    })
    return { game: startedGame, state: initialState }
}

let counter = 0

// A player that founds what it can, heads for districts the Emperor wants, digs canals beside
// water so districts close, and builds temples where it stands.
function choose(game, state, random) {
    const hydrated = new HydratedMexicaGameState(structuredClone(state))
    const [playerId] = state.activePlayerIds
    const base = () => ({
        id: `s${counter++}`,
        gameId: game.id,
        source: ActionSource.User,
        playerId
    })
    const pick = (items) => items[Math.floor(random() * items.length)]
    if (state.machineState === MachineState.ChoosingStart) {
        const cell = START_CELLS.find((start) => hydrated.canStartOn(start))
        return [{ ...base(), type: ActionType.ChooseStart, cell }]
    }
    const layout = hydrated.layout()
    const ap = hydrated.apAvailable(playerId)
    const options = []
    const district = hydrated.pilliDistrict(playerId, layout)
    if (district && hydrated.foundingToken(playerId, layout) !== undefined) {
        for (const cell of district.filter((c) => layout.isBuildable(c))) {
            options.push({
                weight: 50,
                action: { ...base(), type: ActionType.FoundDistrict, cell }
            })
        }
    }
    if (ap > 0) {
        const wanted = new Set(state.display.map(tokenSize))
        const moves = hydrated.moves(playerId, layout)
        for (const target of layout.districts()) {
            if (!wanted.has(target.length) || layout.tokenIn(target) !== undefined) continue
            for (const cell of target) {
                const move = moves.get(cell)
                if (move && move.cost <= ap)
                    options.push({
                        weight: 8,
                        action: { ...base(), type: ActionType.MovePilli, to: cell }
                    })
            }
        }
        const anywhere = [...moves.entries()].filter(([, move]) => move.cost <= Math.min(ap, 2))
        for (const [cell] of anywhere.slice(0, 4)) {
            options.push({
                weight: 0.4,
                action: { ...base(), type: ActionType.MovePilli, to: cell }
            })
        }
        if (district) {
            const levels = LEVELS.filter(
                (level) => level <= ap && hydrated.templesLeft(playerId, level) > 0
            )
            const cells = district.filter((cell) => layout.isBuildable(cell))
            if (levels.length > 0 && cells.length > 0) {
                for (let i = 0; i < 3; i++) {
                    options.push({
                        weight: 2,
                        action: {
                            ...base(),
                            type: ActionType.BuildTemple,
                            cell: pick(cells),
                            level: pick(levels)
                        }
                    })
                }
            }
        }
        const diggable = LAND_CELLS.filter((cell) => hydrated.canDigAt(cell, layout))
        const byWater = diggable.filter(
            (cell) => neighbours(cell).some((n) => layout.isWater(n)) || neighbours(cell).length < 4
        )
        for (let i = 0; i < 4 && byWater.length > 0; i++) {
            const cell = pick(byWater)
            const partner = diggable.find((other) => areAdjacent(cell, other) && random() < 0.5)
            const cells =
                partner !== undefined && hydrated.doubleCanalsLeft() > 0 ? [cell, partner] : [cell]
            if (cells.length === 1 && hydrated.singleCanalsLeft() === 0) continue
            options.push({ weight: 1.2, action: { ...base(), type: ActionType.DigCanal, cells } })
        }
        if (hydrated.bridgesLeft() > 0) {
            for (const cell of layout.canals) {
                for (const axis of [Axis.NorthSouth, Axis.EastWest]) {
                    if (layout.bridgeFits(cell, axis) && random() < 0.15) {
                        options.push({
                            weight: 1,
                            action: { ...base(), type: ActionType.BuildBridge, cell, axis }
                        })
                    }
                }
            }
        }
        if (hydrated.canTakeToken() && random() < 0.1) {
            options.push({ weight: 1, action: { ...base(), type: ActionType.TakeToken } })
        }
    }
    options.push({ weight: ap === 0 ? 100 : 0.5, action: { ...base(), type: ActionType.EndTurn } })
    const total = options.reduce((sum, option) => sum + option.weight, 0)
    let roll = random() * total
    const ordered = options.filter((option) => (roll -= option.weight) < 0)
    return [ordered[0]?.action ?? options.at(-1).action, ...options.map((option) => option.action)]
}

// Plays the seeded player until `done` says stop at the start of a turn.
function playUntil({ game, state }, seed, done) {
    let value = seed
    const random = () => {
        value = (value * 1103515245 + 12345) % 2147483648
        return value / 2147483648
    }
    for (let step = 0; step < 4000; step++) {
        if (state.machineState === MachineState.EndOfGame) return undefined
        if (
            state.machineState === MachineState.Acting &&
            state.apLeft === 6 &&
            !state.acted &&
            done(state)
        ) {
            return { game, state }
        }
        for (const action of choose(game, state, random)) {
            try {
                state = engine.executeCanonicalAction({ game, state, action }).updatedState
                break
            } catch {
                // Not allowed here (the first round shuts nobody in); try the next.
            }
        }
    }
    return undefined
}

function write(slug, name, scenario) {
    const file = startingPositionFile({ slug, name, ...scenario })
    writeFileSync(join(OUT, file.fileName), file.contents)
}

function describe(state) {
    return `${state.districts.length} districts, ${state.temples.length} temples, ${state.bridges.length} bridges, ${state.canals.length} canals, period ${state.period}`
}

function firstFound(players, from, done) {
    for (let seed = from; seed < from + 80; seed++) {
        const found = playUntil(start(players), seed, done)
        if (found) return found
    }
    throw Error('No seed reached the position')
}

for (const old of readdirSync(OUT).filter((file) => file.endsWith('.json'))) {
    rmSync(join(OUT, old))
}

const middle = firstFound(
    4,
    1,
    (state) =>
        state.period === 1 &&
        state.districts.length >= 3 &&
        state.bridges.length >= 3 &&
        state.temples.length >= 14 &&
        state.canals.length <= 36
)
write('middle-game', 'Middle game', middle)
console.log(`Middle game: ${describe(middle.state)}`)

const late = firstFound(
    3,
    1,
    (state) => state.period === 2 && state.districts.length >= 6 && state.temples.length >= 30
)
write('late-game', 'Late game', late)
console.log(`Late game: ${describe(late.state)}`)
