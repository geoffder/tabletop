// Writes the harness's scenarios: `node scripts/build-scenarios.mjs` after building
// `@tabletop/homeworlds`.
import { readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defaultGameConfig, GameEngine, PlayerStatus } from '@tabletop/common'
import { startingPositionFile } from '@tabletop/common/testing'
import {
    Definition,
    HOMEWORLD_SYSTEM_IDS,
    HomeworldsGameStateValidator,
    HomeworldsInfo,
    HomeworldsRuntime,
    HydratedHomeworldsGameState,
    MachineState,
    piecesOfKind,
    PyramidColor,
    Setup
} from '@tabletop/homeworlds'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'scenarios')
const engine = new GameEngine(HomeworldsRuntime)
const ALICE = 'player-1'
const BOB = 'player-2'

const COLORS = {
    r: PyramidColor.Red,
    y: PyramidColor.Yellow,
    g: PyramidColor.Green,
    b: PyramidColor.Blue
}

// Systems from short piece names ('g3' a Large green); Alice is to take a turn.
function position(layout, toMove = ALICE) {
    const game = HomeworldsRuntime.initializer.initializeGame(
        {
            id: 'scenario',
            typeId: 'homeworlds',
            ownerId: 'owner',
            config: {
                ...defaultGameConfig(HomeworldsInfo.configurator?.options ?? []),
                setup: Setup.FirstGame
            },
            players: [ALICE, BOB].map((id, index) => ({
                id,
                name: index === 0 ? 'Alice' : 'Bob',
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
    const { startedGame, initialState: state } = engine.startGame(game, {
        startingPositions: { playerIds: [ALICE, BOB] }
    })
    const used = new Set()
    const take = (code) => {
        const piece = piecesOfKind({ color: COLORS[code[0]], size: Number(code[1]) }).find(
            (id) => !used.has(id)
        )
        if (piece === undefined) throw Error(`No ${code} left`)
        used.add(piece)
        return piece
    }
    state.starMap.systems = layout.map((system) => {
        const stars = system.stars.map(take)
        const ships = (system.ships ?? []).map(([code, owner]) => ({
            piece: take(code),
            ownerId: owner === 'A' ? ALICE : BOB
        }))
        const home = system.home === 'A' ? ALICE : system.home === 'B' ? BOB : undefined
        return {
            id:
                home === ALICE
                    ? HOMEWORLD_SYSTEM_IDS[0]
                    : home === BOB
                      ? HOMEWORLD_SYSTEM_IDS[1]
                      : stars[0],
            stars,
            ships,
            ...(home ? { homeworldOf: home } : {})
        }
    })
    state.machineState = MachineState.TakingTurn
    state.activePlayerIds = [toMove]
    state.turnManager.series = [{ ...state.turnManager.series[0], playerId: toMove }]
    state.positions = [new HydratedHomeworldsGameState(state).positionHash(toMove)]
    if (!HomeworldsGameStateValidator.Check(state)) throw Error('Not a valid state')
    return { game: startedGame, state }
}

function write(slug, name, scenario) {
    const file = startingPositionFile({ slug, name, ...scenario })
    writeFileSync(join(OUT, file.fileName), file.contents)
}

for (const old of readdirSync(OUT).filter((file) => file.endsWith('.json'))) {
    rmSync(join(OUT, old))
}

write(
    'middle-game',
    'Middle game',
    position([
        {
            home: 'A',
            stars: ['b1', 'r2'],
            ships: [
                ['g3', 'A'],
                ['y2', 'A'],
                ['b1', 'A']
            ]
        },
        {
            home: 'B',
            stars: ['y3', 'b1'],
            ships: [
                ['g3', 'B'],
                ['r1', 'B'],
                ['g1', 'B']
            ]
        },
        {
            stars: ['g3'],
            ships: [
                ['y1', 'A'],
                ['g1', 'A'],
                ['b2', 'B']
            ]
        },
        { stars: ['r3'], ships: [['g2', 'A']] },
        {
            stars: ['b2'],
            ships: [
                ['y1', 'B'],
                ['r2', 'B']
            ]
        },
        {
            stars: ['y1'],
            ships: [
                ['b3', 'A'],
                ['r1', 'B']
            ]
        }
    ])
)

write(
    'catastrophe',
    'Catastrophe',
    position([
        {
            home: 'A',
            stars: ['b1', 'r2'],
            ships: [
                ['g3', 'A'],
                ['y2', 'A']
            ]
        },
        {
            home: 'B',
            stars: ['y3', 'b1'],
            ships: [
                ['g3', 'B'],
                ['g2', 'B']
            ]
        },
        {
            stars: ['g3'],
            ships: [
                ['g1', 'A'],
                ['y1', 'A'],
                ['g1', 'B'],
                ['g2', 'A']
            ]
        }
    ])
)

write(
    'sacrifice',
    'Sacrifice',
    position([
        {
            home: 'A',
            stars: ['b1', 'r2'],
            ships: [
                ['g3', 'A'],
                ['y3', 'A']
            ]
        },
        {
            home: 'B',
            stars: ['y2', 'b1'],
            ships: [
                ['g3', 'B'],
                ['r1', 'B']
            ]
        },
        {
            stars: ['g3'],
            ships: [
                ['b1', 'A'],
                ['r1', 'A']
            ]
        },
        { stars: ['r3'], ships: [['g1', 'B']] }
    ])
)

write(
    'direct-assault',
    'Direct assault',
    position([
        {
            home: 'A',
            stars: ['b1', 'r2'],
            ships: [
                ['g3', 'A'],
                ['b2', 'A']
            ]
        },
        {
            home: 'B',
            stars: ['r3', 'b1'],
            ships: [
                ['g2', 'B'],
                ['y3', 'A']
            ]
        },
        { stars: ['y1'], ships: [['g1', 'B']] }
    ])
)
console.log('Written to', OUT)
