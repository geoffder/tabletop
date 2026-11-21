// Writes the positions the dev harness offers under Scenarios, one file each in ../src/scenarios.
// Build the logic package first: node scripts/build-scenarios.mjs
import { readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ActionSource, defaultGameConfig, GameEngine, PlayerStatus } from '@tabletop/common'
import { startingPositionFile } from '@tabletop/common/testing'
import {
    ActionType,
    CardColor,
    Country,
    SPACES,
    Definition,
    HydratedWebOfPowerGameState,
    MachineState,
    WebOfPowerInfo,
    WebOfPowerRuntime
} from '@tabletop/web-of-power'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'scenarios')
const engine = new GameEngine(WebOfPowerRuntime)
const NAMES = ['Alice', 'Bob', 'Carol', 'Dan', 'Eve']
const MASTER_SEED = '0123456789abcdef0123456789abcdef'

function start(count, config = {}) {
    const ids = NAMES.slice(0, count).map((_, index) => `player-${index + 1}`)
    const game = WebOfPowerRuntime.initializer.initializeGame(
        {
            id: 'scenario',
            typeId: 'web-of-power',
            ownerId: 'owner',
            config: {
                ...defaultGameConfig(WebOfPowerInfo.configurator?.options ?? []),
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
// Every action the player to act may take.
function legalActions(game, state) {
    const hydrated = new HydratedWebOfPowerGameState(state)
    const [playerId] = state.activePlayerIds
    const base = () => ({
        id: `s${counter++}`,
        gameId: game.id,
        source: ActionSource.User,
        playerId
    })
    if (state.machineState === MachineState.Drawing) {
        return [
            ...[...new Set(state.display)].map((card) => ({
                ...base(),
                type: ActionType.DrawFaceUp,
                card
            })),
            ...(state.deck.remaining > 0
                ? [{ ...base(), type: ActionType.DrawFromDeck, revealsInfo: true }]
                : [])
        ]
    }
    const faster = game.config.fasterVariant === true
    const placing = hydrated.targets(playerId, faster).flatMap((target) =>
        hydrated.payments(playerId, target.country).map((cards) => ({
            ...base(),
            type: ActionType.PlacePiece,
            cards,
            ...target
        }))
    )
    if (placing.length > 0) return placing
    if (state.placements.length > 0) return [{ ...base(), type: ActionType.EndPlacing }]
    const hand = hydrated.getPlayerState(playerId).knownHand()
    return [{ ...base(), type: ActionType.ExchangeCard, card: hand[0] }]
}

// Plays seeded legal actions until `done` says stop, at the start of a player's turn.
function playUntil({ game, state }, seed, done) {
    let value = seed
    for (let step = 0; step < 2000; step++) {
        if (
            state.machineState === MachineState.PlacingPieces &&
            state.placements.length === 0 &&
            done(state)
        ) {
            return { game, state }
        }
        const actions = legalActions(game, state)
        value = (value * 1103515245 + 12345) % 2147483648
        // Advisors have far fewer places than cloisters, so give them a fair share of turns.
        const advisors = actions.filter((action) => action.kind === 'advisor')
        const pool = advisors.length > 0 && value % 3 === 0 ? advisors : actions
        value = (value * 1103515245 + 12345) % 2147483648
        state = engine.executeCanonicalAction({
            game,
            state,
            action: pool[value % pool.length]
        }).updatedState
    }
    throw Error('The position was never reached')
}

function write(slug, name, scenario) {
    const file = startingPositionFile({ slug, name, ...scenario })
    writeFileSync(join(OUT, file.fileName), file.contents)
}

for (const old of readdirSync(OUT).filter((file) => file.endsWith('.json'))) {
    rmSync(join(OUT, old))
}

// Four players part way through the first pass of the deck.
const middle = playUntil(
    start(4),
    11,
    (state) => state.cloisters.length >= 24 && state.advisors.length >= 6
)
write('middle-game', 'Middle game', middle)
console.log(
    `Middle game: ${middle.state.cloisters.length} cloisters, ${middle.state.advisors.length} advisors`
)

// Five players late in the game, the map nearly full.
const late = playUntil(
    start(5),
    5,
    (state) => state.deckExhaustions >= 1 && state.cloisters.length >= 40
)
write('late-game', 'Late game', late)
console.log(
    `Late game: ${late.state.cloisters.length} cloisters, ${late.state.advisors.length} advisors`
)

// Five players, Eve (red) to play with a Franken/Aragon card, her houses already standing in red
// Franken and Aragon and places still open there: for judging red pieces on lit red countries.
const RED = new Set([Country.Franken, Country.Aragon])
const countryOf = new Map(SPACES.map((space) => [space.abbey, space.country]))
let red
for (let seed = 1; seed < 400 && !red; seed++) {
    try {
        red = playUntil(start(5), seed, (state) => {
            if (state.activePlayerIds[0] !== 'player-5' || state.cloisters.length < 22) return false
            const hydrated = new HydratedWebOfPowerGameState(state)
            const hand = hydrated.getPlayerState('player-5').knownHand()
            const inRed = state.cloisters.filter(
                (cloister) =>
                    cloister.playerId === 'player-5' && RED.has(countryOf.get(cloister.abbey))
            ).length
            const open = hydrated
                .targets('player-5', false)
                .filter((target) => RED.has(target.country)).length
            return hand.includes(CardColor.FrankenAragon) && inRed >= 3 && open >= 3
        })
    } catch {
        red = undefined
    }
}
if (!red) throw Error('No red position found')
write('red-country', 'Red country', red)
console.log(`Red country: ${red.state.cloisters.length} cloisters`)

// One card left in the deck: whoever draws it brings on the interim scoring (cloisters only). And
// the final round, after the deck has run out the second time: each plays or passes once more, and
// then the final scoring.
for (const [slug, name, passes, remaining] of [
    ['interim-scoring', 'Interim scoring next', 0, 1],
    ['final-round', 'Final round', 2, 0]
]) {
    let found
    for (let seed = 1; seed < 200 && !found; seed++) {
        try {
            found = playUntil(
                start(4),
                seed,
                (state) => state.deckExhaustions === passes && state.deck.remaining === remaining
            )
        } catch {
            found = undefined
        }
    }
    if (!found) throw Error(`No position for ${name}`)
    write(slug, name, found)
    console.log(
        `${name}: ${found.state.cloisters.length} cloisters, ${found.state.advisors.length} advisors`
    )
}
