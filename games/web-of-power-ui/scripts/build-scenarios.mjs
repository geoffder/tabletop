// Writes the positions the dev harness offers under Scenarios, one file each in ../src/scenarios.
// Build the logic package first: node scripts/build-scenarios.mjs
import { readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ActionSource, defaultGameConfig, GameEngine, PlayerStatus } from '@tabletop/common'
import { startingPositionFile } from '@tabletop/common/testing'
import {
    ActionType,
    ALLIANCES,
    CARD_COUNTRIES,
    CardColor,
    Country,
    longestChains,
    PieceKind,
    roadNeighbours,
    SCORING_ORDER,
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
    if (hydrated.isFinalRound()) return [{ ...base(), type: ActionType.Pass }]
    const hand = hydrated.getPlayerState(playerId).knownHand()
    return [{ ...base(), type: ActionType.ExchangeCard, card: hand[0] }]
}

function playUntil({ game, state }, seed, done, prefer = (actions) => actions) {
    let value = seed
    for (let step = 0; step < 2000; step++) {
        if (
            state.machineState === MachineState.PlacingPieces &&
            state.placements.length === 0 &&
            done(state, game)
        ) {
            return { game, state }
        }
        const actions = prefer(legalActions(game, state), state)
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

const middle = playUntil(
    start(4),
    11,
    (state) => state.cloisters.length >= 24 && state.advisors.length >= 6
)
write('middle-game', 'Middle game', middle)
console.log(
    `Middle game: ${middle.state.cloisters.length} cloisters, ${middle.state.advisors.length} advisors`
)

const late = playUntil(
    start(5),
    5,
    (state) => state.deckExhaustions >= 1 && state.cloisters.length >= 40
)
write('late-game', 'Late game', late)
console.log(
    `Late game: ${late.state.cloisters.length} cloisters, ${late.state.advisors.length} advisors`
)

// For judging red pieces on lit red countries.
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

function search(players, done, { config, prefer, seeds = 400 } = {}) {
    for (let seed = 1; seed < seeds; seed++) {
        try {
            return playUntil(start(players, config), seed, done, prefer)
        } catch {
            // This seed's game never reached the position.
        }
    }
    throw Error('No seed reaches the position')
}

function endsOnPass(state, game) {
    if (!new HydratedWebOfPowerGameState(state).isFinalRound()) return false
    const [playerId] = state.activePlayerIds
    const { updatedState } = engine.executeCanonicalAction({
        game,
        state,
        action: {
            id: 'probe',
            gameId: game.id,
            source: ActionSource.User,
            playerId,
            type: ActionType.Pass
        }
    })
    return updatedState.machineState === MachineState.EndOfGame
}

function hand(state, playerId) {
    return new HydratedWebOfPowerGameState(state).getPlayerState(playerId).knownHand()
}

const joker = search(4, (state) => {
    const [playerId] = state.activePlayerIds
    if (playerId !== 'player-1' || state.cloisters.length < 12) return false
    const cards = hand(state, playerId)
    if (cards.every((card, index) => cards.indexOf(card) === index)) return false
    const named = new Set(cards.flatMap((card) => CARD_COUNTRIES[card]))
    return new HydratedWebOfPowerGameState(state)
        .targets(playerId, false)
        .some((target) => !named.has(target.country))
})
write('joker', 'Joker', joker)
console.log(`Joker: ${hand(joker.state, 'player-1').join(' ')}`)

const tie = search(4, (state, game) => {
    if (!endsOnPass(state, game)) return false
    const [playerId] = state.activePlayerIds
    const shared = new HydratedWebOfPowerGameState(state)
        .allianceAwards()
        .filter((alliance) => alliance.awards.length > 1)
    return shared.length === 1 && shared[0].awards.some((award) => award.playerId === playerId)
})
write('alliance-tie', 'Alliance tie', tie)
console.log(
    `Alliance tie: ${JSON.stringify(new HydratedWebOfPowerGameState(tie.state).allianceAwards())}`
)

function groupsOf(state, playerId) {
    const mine = new Set(state.cloisters.filter((c) => c.playerId === playerId).map((c) => c.abbey))
    const groups = []
    const seen = new Set()
    for (const start of mine) {
        if (seen.has(start)) continue
        const group = new Set([start])
        const queue = [start]
        for (let abbey = queue.pop(); abbey !== undefined; abbey = queue.pop()) {
            for (const next of roadNeighbours(abbey)) {
                if (mine.has(next) && !group.has(next)) {
                    group.add(next)
                    queue.push(next)
                }
            }
        }
        for (const abbey of group) seen.add(abbey)
        groups.push(group)
    }
    return groups
}

// Dan builds along the roads, so his cloisters gather into a chain with a branch.
const builder = 'player-4'
const branch = search(
    4,
    (state, game) => {
        if (!endsOnPass(state, game)) return false
        return groupsOf(state, builder).some((group) => {
            const [chain] = longestChains(group)
            return chain !== undefined && group.size >= chain.length + 2
        })
    },
    {
        prefer: (actions, state) => {
            if (state.activePlayerIds[0] !== builder) return actions
            const mine = new Set(
                state.cloisters.filter((c) => c.playerId === builder).map((c) => c.abbey)
            )
            const along = actions.filter(
                (action) =>
                    action.kind === PieceKind.Cloister &&
                    roadNeighbours(action.abbey).some((abbey) => mine.has(abbey))
            )
            const cloisters = actions.filter((action) => action.kind === PieceKind.Cloister)
            return along.length > 0 ? along : cloisters.length > 0 ? cloisters : actions
        }
    }
)
write('branched-chain', 'Branched chain', branch)
console.log(
    `Branched chain: ${groupsOf(branch.state, builder)
        .map((group) => `${group.size}/${longestChains(group)[0]?.length ?? 0}`)
        .join(' ')}`
)

const faster = search(
    4,
    (state) => {
        const [playerId] = state.activePlayerIds
        if (playerId !== 'player-1' || state.cloisters.length < 4) return false
        const hydrated = new HydratedWebOfPowerGameState(state)
        const cards = hand(state, playerId)
        const pays = (country) => cards.some((card) => CARD_COUNTRIES[card].includes(country))
        const empty = SCORING_ORDER.filter(
            (country) => hydrated.cloistersIn(country).length === 0 && pays(country)
        )
        const advisors = hydrated
            .targets(playerId, true)
            .filter((target) => target.kind === PieceKind.Advisor && pays(target.country))
        return empty.length > 0 && advisors.length > 0
    },
    { config: { fasterVariant: true } }
)
write('faster-variant', 'Faster variant', faster)
console.log(`Faster variant: ${faster.state.cloisters.length} cloisters`)

// Random play always runs the deck out first, so the full board is the late game filled in: every
// space taken but one, and every country holding as many advisors as it allows. The player to move
// can pay for the last space, and a cloister there leaves no room for another advisor.
function nearlyFull({ game, state: base }) {
    const [mover] = base.activePlayerIds
    const cards = hand(base, mover)
    const free = SPACES.filter((space) => !base.cloisters.some((c) => c.abbey === space.abbey))
    for (const last of free) {
        if (!cards.some((card) => CARD_COUNTRIES[card].includes(last.country))) continue
        const state = structuredClone(base)
        const left = () =>
            new Map(
                state.players.map((player) => [
                    player.playerId,
                    new HydratedWebOfPowerGameState(state).cloistersLeft(player.playerId)
                ])
            )
        for (const space of free) {
            if (space === last) continue
            const counts = left()
            const [playerId] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
            state.cloisters.push({ abbey: space.abbey, playerId })
        }
        const hydrated = new HydratedWebOfPowerGameState(state)
        const moverThere = hydrated.cloisterCounts(last.country).get(mover) ?? 0
        if (moverThere + 1 > hydrated.advisorLimit(last.country)) continue
        let short = false
        for (const country of SCORING_ORDER) {
            while (
                !short &&
                state.advisors.filter((a) => a.country === country).length <
                    new HydratedWebOfPowerGameState(state).advisorLimit(country)
            ) {
                const current = new HydratedWebOfPowerGameState(state)
                const [playerId, count] = state.players
                    .map((player) => [player.playerId, current.advisorsLeft(player.playerId)])
                    .sort((a, b) => b[1] - a[1])[0]
                if (count === 0) short = true
                else state.advisors.push({ country, playerId })
            }
        }
        if (short) continue
        const card = cards.find((c) => CARD_COUNTRIES[c].includes(last.country))
        const { updatedState } = engine.executeCanonicalAction({
            game,
            state,
            action: {
                id: 'probe',
                gameId: game.id,
                source: ActionSource.User,
                playerId: mover,
                type: ActionType.PlacePiece,
                cards: [card],
                kind: PieceKind.Cloister,
                country: last.country,
                abbey: last.abbey
            }
        })
        if (updatedState.machineState !== MachineState.EndOfGame) continue
        return { game, state, last }
    }
    throw Error('No space can be the last')
}
const full = nearlyFull(late)
write('nearly-full', 'Nearly full', full)
console.log(`Nearly full: the last space is ${full.last.abbey} in ${full.last.country}`)
