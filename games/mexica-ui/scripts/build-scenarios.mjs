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
    cellAt,
    DISTRICT_SIZES,
    isLake,
    columnOf,
    rowOf,
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

// Two players who are not to move stand on bridges with something low just behind them, where
// the figure covers most: one in front of a level-1 temple, the other in front of a district's
// token, founding that district with a token of its size when none stands there yet.
function pilliCover(state) {
    const hydrated = new HydratedMexicaGameState(structuredClone(state))
    const layout = hydrated.layout()
    const [mover] = state.activePlayerIds
    const others = hydrated.players.filter((player) => player.playerId !== mover)
    const taken = new Set(hydrated.players.map((player) => player.pilli))
    const free = [...layout.bridges.keys()]
        .filter((bridge) => !taken.has(bridge) && rowOf(bridge) > 0)
        .sort((a, b) => a - b)
    const behind = (bridge) => cellAt(columnOf(bridge), rowOf(bridge) - 1)
    const temple = free.find((bridge) =>
        state.temples.some((built) => built.cell === behind(bridge) && built.level === 1)
    )
    if (temple === undefined) return undefined
    const used = new Set(hydrated.districts.map((district) => district.tokenId))
    const tokenFor = (district) =>
        [...hydrated.display, ...hydrated.reserve].find(
            (id) => !used.has(id) && tokenSize(id) === district.length
        )
    let founding
    const token = free.find((bridge) => {
        if (bridge === temple) return false
        const square = behind(bridge)
        if (hydrated.districts.some((district) => district.cell === square)) return true
        const district = layout.districtOf(square)
        if (district === undefined || layout.tokenIn(district) !== undefined) return false
        if (!layout.isBuildable(square) || tokenFor(district) === undefined) return false
        founding = { tokenId: tokenFor(district), cell: square }
        return true
    })
    if (token === undefined || others.length < 2) return undefined
    if (founding !== undefined) {
        hydrated.districts.push(founding)
        hydrated.display = hydrated.display.filter((id) => id !== founding.tokenId)
        hydrated.reserve = hydrated.reserve.filter((id) => id !== founding.tokenId)
    }
    hydrated.getPlayerState(others[0].playerId).pilli = temple
    hydrated.getPlayerState(others[1].playerId).pilli = token
    return hydrated.dehydrate()
}

// Free ground in `district` round no Pilli Mexica, the palace or anything built.
function freeIn(layout, district) {
    return district.filter((cell) => layout.isBuildable(cell))
}

// A square of `district` across the island from the display, in its top left, with a temple of
// three or more levels on the square in front of it, for a token to drop in behind.
function behindTemple(state, layout, district) {
    return freeIn(layout, district).find((square) => {
        if (columnOf(square) > 8 || rowOf(square) > 6) return false
        const front = cellAt(columnOf(square), rowOf(square) + 1)
        return state.temples.some((temple) => temple.cell === front && temple.level >= 3)
    })
}

// Three players can found on their turns, in turn order from the player to move: the first
// across the island from the display, in its top left, behind a tall temple; the second by the display; the
// third in another district, with the fourth player's Pilli Mexica standing in it as a
// visitor. The Pilli Mexica are placed and the
// display stocked to match.
function foundingRound(state) {
    const hydrated = new HydratedMexicaGameState(structuredClone(state))
    for (const player of hydrated.players) player.pilli = undefined
    const layout = hydrated.layout()
    const used = new Set(hydrated.districts.map((district) => district.tokenId))
    const unused = DISTRICT_SIZES.map((_, id) => id).filter((id) => !used.has(id))
    const open = layout
        .districts()
        .filter((district) => layout.tokenIn(district) === undefined && district.length >= 3)
    const taken = new Set()
    const tokenFor = (district) =>
        unused.find((id) => !taken.has(id) && tokenSize(id) === district.length)
    const far = open.find(
        (district) => tokenFor(district) !== undefined && behindTemple(hydrated, layout, district)
    )
    if (far === undefined) return undefined
    taken.add(tokenFor(far))
    const near = open.find(
        (district) =>
            district !== far &&
            freeIn(layout, district).length >= 2 &&
            tokenFor(district) !== undefined &&
            district.some((cell) => columnOf(cell) >= 12 && rowOf(cell) >= 7)
    )
    if (near === undefined) return undefined
    taken.add(tokenFor(near))
    const middle = open.find(
        (district) =>
            district !== far &&
            district !== near &&
            freeIn(layout, district).length >= 3 &&
            tokenFor(district) !== undefined
    )
    if (middle === undefined) return undefined
    const farToken = [...taken][0]
    const nearToken = [...taken][1]
    const middleToken = tokenFor(middle)
    taken.add(middleToken)

    const order = hydrated.turnManager.turnOrder
    const first = order.indexOf(state.activePlayerIds[0])
    const turns = order.map((_, index) => order[(first + index) % order.length])
    const behind = behindTemple(hydrated, layout, far)
    const stand = (playerId, district, avoid = []) => {
        const cell = freeIn(hydrated.layout(), district).find((square) => !avoid.includes(square))
        hydrated.getPlayerState(playerId).pilli = cell
    }
    stand(turns[0], far, [behind])
    stand(turns[1], near)
    stand(turns[2], middle)
    stand(turns[3], middle)

    const others = unused.filter((id) => !taken.has(id))
    const display = [farToken, nearToken, ...others.slice(0, 3), middleToken, ...others.slice(3, 5)]
    hydrated.display = display
    hydrated.reserve = unused.filter((id) => !display.includes(id))
    return hydrated.dehydrate()
}

// The player to move stands where its Pilli Mexica can reach, within its action points, each way
// of moving by water: a hop between bridges side by side, a canoe ride, a ride hopping over a
// bridge on the way, and a ride round the island beyond the board's edge.
function canalRides(state) {
    const hydrated = new HydratedMexicaGameState(structuredClone(state))
    const [playerId] = state.activePlayerIds
    const others = hydrated.players.filter((player) => player.playerId !== playerId)
    const occupied = new Set(others.map((player) => player.pilli))
    const ap = hydrated.apAvailable(playerId)
    for (const start of [...LAND_CELLS].sort((a, b) => a - b)) {
        if (occupied.has(start)) continue
        const trial = new HydratedMexicaGameState(structuredClone(hydrated.dehydrate()))
        trial.getPlayerState(playerId).pilli = start
        const layout = trial.layout()
        if (!layout.isEmptyGround(start) && !layout.bridges.has(start)) continue
        const kinds = new Set()
        for (const [, move] of trial.moves(playerId)) {
            if (move.teleport || move.cost > ap) continue
            let run = 0
            move.path.forEach((cell, index) => {
                const last = move.path[index - 1]
                if (index === 0 || !layout.bridges.has(cell) || !layout.bridges.has(last)) {
                    run = 0
                    return
                }
                if (areAdjacent(last, cell)) {
                    kinds.add('hop')
                    run = 0
                    return
                }
                run++
                kinds.add('ride')
                if (run >= 2) kinds.add('over')
                if (!waterJoins(layout, last, cell)) kinds.add('round')
            })
        }
        if (kinds.size === 4) return trial.dehydrate()
    }
    return undefined
}

// A ride along a canal, no lake on the way, under a bridge with another player's Pilli Mexica
// moved onto it, to an empty bridge just beyond, so the riding Pilli Mexica jumps over it onto
// that bridge.
function jumpOver(state) {
    const hydrated = new HydratedMexicaGameState(structuredClone(state))
    const [playerId] = state.activePlayerIds
    const ap = hydrated.apAvailable(playerId)
    const others = hydrated.players.filter((player) => player.playerId !== playerId)
    const occupied = new Set(others.map((player) => player.pilli))
    let best
    for (const start of [...hydrated.layout().bridges.keys()].sort((a, b) => a - b)) {
        if (occupied.has(start)) continue
        const trial = new HydratedMexicaGameState(structuredClone(hydrated.dehydrate()))
        trial.getPlayerState(playerId).pilli = start
        const layout = trial.layout()
        for (const [, move] of trial.moves(playerId)) {
            if (move.teleport || move.cost > ap) continue
            move.path.slice(1, -1).forEach((cell, index) => {
                const [last, next] = [move.path[index], move.path[index + 2]]
                if (![last, cell, next].every((stop) => layout.bridges.has(stop))) return
                const there = canalWay(layout, last, cell)
                const on = canalWay(layout, cell, next)
                if (there === undefined || on === undefined || there < 2) return
                const rank = on * 100 + there
                if (best === undefined || rank < best.rank) best = { start, cell, rank }
            })
        }
    }
    if (best === undefined) return undefined
    const jumped = new HydratedMexicaGameState(structuredClone(hydrated.dehydrate()))
    jumped.getPlayerState(playerId).pilli = best.start
    const layout = jumped.layout()
    const other = others.find((player) => !layout.bridges.has(player.pilli))
    if (other === undefined) return undefined
    jumped.getPlayerState(other.playerId).pilli = best.cell
    return jumped.dehydrate()
}

// The squares of water from one bridge to the next along canals alone, under no other bridge,
// when that is as short as any way across the lake; otherwise undefined.
function canalWay(layout, from, to) {
    const canal = (cell) => layout.canals.has(cell) && !layout.bridges.has(cell)
    const alone = waterSteps(layout, from, to, canal)
    const any = waterSteps(layout, from, to, (cell) => canal(cell) || isLake(cell))
    return alone !== undefined && alone === any ? alone : undefined
}

// A ride from bridge to bridge under a bridge between, with another player's Pilli Mexica moved
// onto it, and far enough on to the next bridge that the riding Pilli Mexica jumps over it back
// into the canoe.
function jumpIntoCanoe(state) {
    const hydrated = new HydratedMexicaGameState(structuredClone(state))
    const [playerId] = state.activePlayerIds
    const ap = hydrated.apAvailable(playerId)
    const others = hydrated.players.filter((player) => player.playerId !== playerId)
    const occupied = new Set(others.map((player) => player.pilli))
    let best
    for (const start of [...hydrated.layout().bridges.keys()].sort((a, b) => a - b)) {
        if (occupied.has(start)) continue
        const trial = new HydratedMexicaGameState(structuredClone(hydrated.dehydrate()))
        trial.getPlayerState(playerId).pilli = start
        const layout = trial.layout()
        for (const [to, move] of trial.moves(playerId)) {
            if (move.teleport || move.cost > ap) continue
            move.path.slice(1, -1).forEach((cell, index) => {
                const [last, next] = [move.path[index], move.path[index + 2]]
                if (![last, cell, next].every((stop) => layout.bridges.has(stop))) return
                const there = waterSteps(layout, last, cell)
                const on = waterSteps(layout, cell, next)
                if (there === undefined || on === undefined || there < 3 || on < 4) return
                if (best === undefined || there + on < best.length) {
                    best = { start, cell, to, length: there + on }
                }
            })
        }
    }
    if (best === undefined) return undefined
    const jumped = new HydratedMexicaGameState(structuredClone(hydrated.dehydrate()))
    jumped.getPlayerState(playerId).pilli = best.start
    const layout = jumped.layout()
    const other = others.find((player) => !layout.bridges.has(player.pilli))
    if (other === undefined) return undefined
    jumped.getPlayerState(other.playerId).pilli = best.cell
    return jumped.dehydrate()
}

// The squares of water from one bridge to the next across canals under no other bridge and the
// lake, or only those squares `afloat` allows; undefined when they join only round the island.
function waterSteps(
    layout,
    from,
    to,
    afloat = (cell) => isLake(cell) || (layout.canals.has(cell) && !layout.bridges.has(cell))
) {
    const steps = new Map([[from, 0]])
    const queue = [from]
    while (queue.length > 0) {
        const cell = queue.shift()
        if (cell === to) return steps.get(cell)
        for (const next of neighbours(cell)) {
            if (steps.has(next) || !(next === to || afloat(next))) continue
            steps.set(next, steps.get(cell) + 1)
            queue.push(next)
        }
    }
    return undefined
}

// Whether the water on the board joins two bridges, along canals under no other bridge and
// across the lake.
function waterJoins(layout, from, to) {
    const seen = new Set([from])
    const queue = [from]
    while (queue.length > 0) {
        const cell = queue.shift()
        if (cell === to) return true
        for (const next of neighbours(cell)) {
            if (seen.has(next)) continue
            const afloat =
                next === to ||
                isLake(next) ||
                (layout.canals.has(next) && !layout.bridges.has(next))
            if (!afloat) continue
            seen.add(next)
            queue.push(next)
        }
    }
    return false
}

function firstSetUp(players, setUp) {
    for (let seed = 1; seed < 400; seed++) {
        let made
        const found = playUntil(start(players), seed, (state) => {
            made = setUp(state)
            return made !== undefined
        })
        if (found) return { game: found.game, state: made }
    }
    throw Error(`No seed reached a position for ${setUp.name}`)
}

const founding = firstSetUp(4, foundingRound)
write('founding', 'Founding', founding)
console.log(`Founding: ${describe(founding.state)}`)

const rides = firstSetUp(4, canalRides)
write('canal-rides', 'Canal rides', rides)
console.log(`Canal rides: ${describe(rides.state)}`)

const jump = firstSetUp(4, jumpOver)
write('jump-over', 'Jump over', jump)
console.log(`Jump over: ${describe(jump.state)}`)

const intoCanoe = firstSetUp(4, jumpIntoCanoe)
write('jump-into-canoe', 'Jump into canoe', intoCanoe)
console.log(`Jump into canoe: ${describe(intoCanoe.state)}`)

const cover = firstSetUp(4, pilliCover)
write('pilli-cover', 'Pilli cover', cover)
console.log(`Pilli cover: ${describe(cover.state)}`)

// The first turn's start where one action of the player's, not a founding, leaves a token on
// the display that no district can take any more.
function ruledOutBy(game, state) {
    for (const action of choose(game, state, () => 0.5).slice(1)) {
        try {
            const after = engine.executeCanonicalAction({ game, state, action }).updatedState
            const founded = after.districts.length > state.districts.length
            if (!founded && after.display.length < state.display.length) return action
        } catch {
            // Not allowed here.
        }
    }
    return undefined
}

function firstRuledOut(players) {
    for (let seed = 1; seed < 300; seed++) {
        const begun = start(players)
        let action
        const found = playUntil(
            begun,
            seed,
            (state) => (action = ruledOutBy(begun.game, state)) !== undefined
        )
        if (found) return { ...found, action }
    }
    throw Error('No seed reached a token being ruled out')
}

const ruled = firstRuledOut(4)
write('ruled-out', 'Ruled out', ruled)
console.log(`Ruled out: ${describe(ruled.state)}, by ${JSON.stringify(ruled.action)}`)

// The last turn of a period: its districts are founded and a player has built every temple, and
// the last player in turn order is to move, so ending the turn scores the period.
const lastTurnOf = (period) => (state) =>
    state.period === period &&
    new HydratedMexicaGameState(structuredClone(state)).periodComplete() &&
    state.activePlayerIds[0] === state.turnManager.turnOrder.at(-1)

const firstScoring = firstFound(4, 1, lastTurnOf(1))
write('first-scoring', 'First scoring', firstScoring)
console.log(`First scoring: ${describe(firstScoring.state)}`)

const finalScoring = firstFound(4, 1, lastTurnOf(2))
write('final-scoring', 'Final scoring', finalScoring)
console.log(`Final scoring: ${describe(finalScoring.state)}`)
