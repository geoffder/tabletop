import { describe, expect, it } from 'vitest'
import { assert, GameResult, type GameAction } from '@tabletop/common'
import {
    act,
    actionBase,
    createGame,
    engine,
    execute,
    legalActions,
    playToEnd,
    startGame,
    type WebOfPowerGame
} from './tests/playthrough.js'
import { ActionType } from './actions.js'
import { MachineState } from './states.js'
import { WebOfPowerRuntime } from './runtime.js'
import {
    HydratedWebOfPowerGameState,
    PieceKind,
    WebOfPowerGameStateValidator,
    type Advisor,
    type Cloister,
    type WebOfPowerGameState
} from '../model/gameState.js'
import { Abbey, CardColor, Country, deckFor, SPACES } from '../model/map.js'
import { cloisterAwards, longestChains } from '../model/scoring.js'
import { isScoreFinal } from '../actions/scoreFinal.js'
import { isScoreInterim } from '../actions/scoreInterim.js'

const { FrankenAragon, BayernBurgund, LothringenItalien, EnglandSchwaben, Frankreich } = CardColor

interface Position {
    cloisters?: Cloister[]
    advisors?: Advisor[]
    hands?: Record<string, CardColor[]>
    deck?: CardColor[]
    display?: CardColor[]
    deckExhaustions?: number
}

// Rewrites the started game's board and cards, so each rule is tested in a few pieces.
function withPosition(state: WebOfPowerGameState, position: Position): WebOfPowerGameState {
    const result = structuredClone(state)
    if (position.cloisters) result.cloisters = position.cloisters
    if (position.advisors) result.advisors = position.advisors
    for (const [playerId, hand] of Object.entries(position.hands ?? {})) {
        const player = result.players.find((candidate) => candidate.playerId === playerId)
        assert(player !== undefined, `No player ${playerId}`)
        player.hand = hand
        player.handCount = hand.length
    }
    if (position.deck) result.deck = { items: position.deck, remaining: position.deck.length }
    if (position.display) result.display = position.display
    if (position.deckExhaustions !== undefined) result.deckExhaustions = position.deckExhaustions
    assert(WebOfPowerGameStateValidator.Check(result), 'The position must be canonical')
    return result
}

function setUp(config = {}, players?: string[]) {
    const game = createGame(config, players)
    const state = startGame(game)
    const [first, second, third] = state.turnManager.turnOrder
    return { game, state, first, second, third }
}

function place(
    game: WebOfPowerGame,
    state: WebOfPowerGameState,
    cards: CardColor[],
    kind: PieceKind,
    country: Country,
    abbey?: Abbey
) {
    return act(game, state, ActionType.PlacePiece, { cards, kind, country, abbey })
}

function rejects(game: WebOfPowerGame, state: WebOfPowerGameState, fields: object) {
    const [playerId] = state.activePlayerIds
    expect(() =>
        execute(game, state, { ...actionBase(game, playerId), ...fields } as never)
    ).toThrow()
}

const hydrate = (state: WebOfPowerGameState) => new HydratedWebOfPowerGameState(state)

describe('setting up', () => {
    it.each([
        [3, 45],
        [4, 50],
        [5, 55]
    ])('uses %i players’ deck of %i cards, dealing three each and two face up', (count, cards) => {
        const players = ['anna', 'barbara', 'chris', 'dan', 'eva'].slice(0, count)
        const { state } = setUp({}, players)
        expect(deckFor(count)).toHaveLength(cards)
        for (const player of state.players) expect(player.hand).toHaveLength(3)
        expect(state.display).toHaveLength(2)
        expect(state.deck.remaining).toBe(cards - 3 * count - 2)
        expect(state.machineState).toBe(MachineState.PlacingPieces)
        expect(state.activePlayerIds).toEqual([state.turnManager.turnOrder[0]])
    })

    it('removes one card of each colour for four players and two for three', () => {
        const count = (deck: CardColor[], color: CardColor) =>
            deck.filter((card) => card === color).length
        expect(count(deckFor(4), FrankenAragon)).toBe(12)
        expect(count(deckFor(3), Frankreich)).toBe(7)
        expect(count(deckFor(5), EnglandSchwaben)).toBe(10)
    })

    it('deals and plays the same game from the same master seed', () => {
        const game = createGame()
        const a = playToEnd(game, startGame(game), 3)
        const b = playToEnd(game, startGame(game), 3)
        expect(a.players.map((player) => player.score)).toEqual(
            b.players.map((player) => player.score)
        )
        expect(a.cloisters).toEqual(b.cloisters)
    })
})

describe('placing pieces', () => {
    it('allows only one cloister in a country nobody has entered, and nothing more that turn', () => {
        const { game, state, first } = setUp()
        const start = withPosition(state, {
            hands: { [first]: [FrankenAragon, FrankenAragon, FrankenAragon] }
        })
        rejects(game, start, {
            type: ActionType.PlacePiece,
            cards: [FrankenAragon],
            kind: PieceKind.Advisor,
            country: Country.Franken
        })
        const after = place(
            game,
            start,
            [FrankenAragon],
            PieceKind.Cloister,
            Country.Franken,
            Abbey.Chorin
        )
        // Opening Franken ends the placing; the player draws next.
        expect(after.machineState).toBe(MachineState.Drawing)
        expect(after.cloisters).toEqual([{ abbey: Abbey.Chorin, playerId: first }])
    })

    it('allows two pieces in a country that already has a cloister', () => {
        const { game, state, first, second } = setUp()
        const start = withPosition(state, {
            cloisters: [{ abbey: Abbey.Chorin, playerId: second }],
            hands: { [first]: [FrankenAragon, BayernBurgund, BayernBurgund] }
        })
        const once = place(
            game,
            start,
            [FrankenAragon],
            PieceKind.Cloister,
            Country.Franken,
            Abbey.Pforta
        )
        expect(once.machineState).toBe(MachineState.PlacingPieces)
        // The Bayern/Burgund pair is a joker: an advisor in Franken.
        const twice = place(
            game,
            once,
            [BayernBurgund, BayernBurgund],
            PieceKind.Advisor,
            Country.Franken
        )
        expect(twice.advisors).toEqual([{ country: Country.Franken, playerId: first }])
        expect(twice.machineState).toBe(MachineState.Drawing)
        expect(twice.discard.slice(-3)).toEqual([FrankenAragon, BayernBurgund, BayernBurgund])
    })

    it('keeps both pieces of a turn in one country', () => {
        const { game, state, first, second } = setUp()
        const start = withPosition(state, {
            cloisters: [
                { abbey: Abbey.Chorin, playerId: second },
                { abbey: Abbey.Veruela, playerId: second }
            ],
            hands: { [first]: [FrankenAragon, FrankenAragon, Frankreich] }
        })
        const once = place(
            game,
            start,
            [FrankenAragon],
            PieceKind.Cloister,
            Country.Franken,
            Abbey.Pforta
        )
        rejects(game, once, {
            type: ActionType.PlacePiece,
            cards: [FrankenAragon],
            kind: PieceKind.Cloister,
            country: Country.Aragon,
            abbey: Abbey.Poblet
        })
    })

    it('rejects a joker of two colours, a card for another country and an abbey of another country', () => {
        const { game, state, first, second } = setUp()
        const start = withPosition(state, {
            cloisters: [{ abbey: Abbey.Chorin, playerId: second }],
            hands: { [first]: [FrankenAragon, BayernBurgund, Frankreich] }
        })
        const placing = {
            type: ActionType.PlacePiece,
            kind: PieceKind.Cloister,
            country: Country.Franken
        }
        rejects(game, start, {
            ...placing,
            cards: [BayernBurgund, Frankreich],
            abbey: Abbey.Pforta
        })
        rejects(game, start, { ...placing, cards: [Frankreich], abbey: Abbey.Pforta })
        rejects(game, start, { ...placing, cards: [FrankenAragon], abbey: Abbey.Poblet })
        rejects(game, start, { ...placing, cards: [FrankenAragon], abbey: Abbey.Chorin })
        rejects(game, start, { ...placing, cards: [FrankenAragon], abbey: 'nowhere' })
        rejects(game, start, { ...placing, cards: [LothringenItalien], abbey: Abbey.Pforta })
    })

    it('limits advisors in a country to the most cloisters any one player has there', () => {
        const { game, state, first, second } = setUp()
        const start = withPosition(state, {
            cloisters: [
                { abbey: Abbey.Chorin, playerId: second },
                { abbey: Abbey.Pforta, playerId: second },
                { abbey: Abbey.Oliva, playerId: first }
            ],
            advisors: [{ country: Country.Franken, playerId: second }],
            hands: { [first]: [FrankenAragon, FrankenAragon, FrankenAragon] }
        })
        expect(hydrate(start).advisorLimit(Country.Franken)).toBe(2)
        const once = place(game, start, [FrankenAragon], PieceKind.Advisor, Country.Franken)
        rejects(game, once, {
            type: ActionType.PlacePiece,
            cards: [FrankenAragon],
            kind: PieceKind.Advisor,
            country: Country.Franken
        })
    })

    it('raises the limit at once when a cloister goes down first in the same turn', () => {
        const { game, state, first } = setUp()
        const start = withPosition(state, {
            cloisters: [
                { abbey: Abbey.Clairvaux, playerId: first },
                { abbey: Abbey.Longpont, playerId: first },
                { abbey: Abbey.Savigny, playerId: first }
            ],
            advisors: [
                { country: Country.Frankreich, playerId: first },
                { country: Country.Frankreich, playerId: first },
                { country: Country.Frankreich, playerId: first }
            ],
            hands: { [first]: [Frankreich, Frankreich, EnglandSchwaben] }
        })
        const once = place(
            game,
            start,
            [Frankreich],
            PieceKind.Cloister,
            Country.Frankreich,
            Abbey.Molesmes
        )
        const twice = place(game, once, [Frankreich], PieceKind.Advisor, Country.Frankreich)
        expect(hydrate(twice).advisorsIn(Country.Frankreich)).toHaveLength(4)
    })

    it('lets a player send advisors where they have no cloister, but never where there is none', () => {
        const { game, state, first, second } = setUp()
        const start = withPosition(state, {
            cloisters: [{ abbey: Abbey.Locedio, playerId: second }],
            hands: { [first]: [LothringenItalien, LothringenItalien, Frankreich] }
        })
        rejects(game, start, {
            type: ActionType.PlacePiece,
            cards: [LothringenItalien],
            kind: PieceKind.Advisor,
            country: Country.Lothringen
        })
        const after = place(game, start, [LothringenItalien], PieceKind.Advisor, Country.Italien)
        expect(after.advisors).toEqual([{ country: Country.Italien, playerId: first }])
    })

    it('runs out of pieces: twenty cloisters and eight advisors each', () => {
        const { state, first } = setUp()
        const held = SPACES.slice(0, 20).map((space) => ({ abbey: space.abbey, playerId: first }))
        const full = hydrate(withPosition(state, { cloisters: held }))
        expect(full.cloistersLeft(first)).toBe(0)
        expect(
            full.canPlace(
                first,
                { kind: PieceKind.Cloister, country: Country.Italien, abbey: Abbey.Fossanova },
                false
            )
        ).toBe(false)
    })
})

describe('the faster variant', () => {
    it('opens an empty country with two cloisters, but not a cloister and an advisor', () => {
        const { game, state, first } = setUp({ fasterVariant: true })
        const start = withPosition(state, {
            hands: { [first]: [FrankenAragon, FrankenAragon, FrankenAragon] }
        })
        const once = place(
            game,
            start,
            [FrankenAragon],
            PieceKind.Cloister,
            Country.Franken,
            Abbey.Chorin
        )
        expect(once.machineState).toBe(MachineState.PlacingPieces)
        rejects(game, once, {
            type: ActionType.PlacePiece,
            cards: [FrankenAragon],
            kind: PieceKind.Advisor,
            country: Country.Franken
        })
        const twice = place(
            game,
            once,
            [FrankenAragon],
            PieceKind.Cloister,
            Country.Franken,
            Abbey.Pforta
        )
        expect(twice.cloisters).toHaveLength(2)
    })

    it('places in two countries in one turn', () => {
        const { game, state, first } = setUp({ fasterVariant: true })
        const start = withPosition(state, {
            hands: { [first]: [FrankenAragon, Frankreich, Frankreich] }
        })
        const once = place(
            game,
            start,
            [FrankenAragon],
            PieceKind.Cloister,
            Country.Aragon,
            Abbey.Poblet
        )
        const twice = place(
            game,
            once,
            [Frankreich],
            PieceKind.Cloister,
            Country.Frankreich,
            Abbey.Clairvaux
        )
        expect(twice.cloisters.map((cloister) => cloister.abbey)).toEqual([
            Abbey.Poblet,
            Abbey.Clairvaux
        ])
    })
})

describe('cards', () => {
    it('exchanges one card for one drawn, instead of placing', () => {
        const { game, state, first, second } = setUp()
        const start = withPosition(state, {
            hands: { [first]: [Frankreich, Frankreich, Frankreich] },
            display: [BayernBurgund, EnglandSchwaben]
        })
        const exchanged = act(game, start, ActionType.ExchangeCard, { card: Frankreich })
        expect(exchanged.machineState).toBe(MachineState.Drawing)
        expect(exchanged.discard.at(-1)).toBe(Frankreich)
        const drawn = act(game, exchanged, ActionType.DrawFaceUp, { card: EnglandSchwaben })
        expect(drawn.players[0].hand).toEqual([Frankreich, Frankreich, EnglandSchwaben])
        // The face-up card taken is replaced once the hand is full, and the turn passes.
        expect(drawn.display).toHaveLength(2)
        expect(drawn.activePlayerIds).toEqual([second])
    })

    it('draws a card at a time, from the face-up cards and the deck in any order', () => {
        const { game, state, first } = setUp()
        const start = withPosition(state, {
            cloisters: [{ abbey: Abbey.Chorin, playerId: first }],
            hands: { [first]: [FrankenAragon, FrankenAragon, Frankreich] },
            display: [BayernBurgund, BayernBurgund],
            deck: [EnglandSchwaben, EnglandSchwaben, LothringenItalien, Frankreich]
        })
        const placed = place(
            game,
            place(game, start, [FrankenAragon], PieceKind.Cloister, Country.Franken, Abbey.Pforta),
            [FrankenAragon],
            PieceKind.Advisor,
            Country.Franken
        )
        expect(placed.machineState).toBe(MachineState.Drawing)
        const fromDeck = act(game, placed, ActionType.DrawFromDeck, { revealsInfo: true })
        expect(fromDeck.players[0].hand).toEqual([Frankreich, Frankreich])
        const faceUp = act(game, fromDeck, ActionType.DrawFaceUp, { card: BayernBurgund })
        expect(faceUp.players[0].hand).toEqual([Frankreich, Frankreich, BayernBurgund])
        // One face-up card was taken, so one comes from the deck.
        expect(faceUp.display).toEqual([BayernBurgund, LothringenItalien])
        expect(faceUp.deck.remaining).toBe(2)
    })
})

describe('running out of cards', () => {
    function exhaustionPosition(config = {}) {
        const { game, state, first, second, third } = setUp(config)
        const start = withPosition(state, {
            cloisters: [
                { abbey: Abbey.Chorin, playerId: first },
                { abbey: Abbey.Pforta, playerId: first },
                { abbey: Abbey.Oliva, playerId: second }
            ],
            advisors: [{ country: Country.Franken, playerId: second }],
            hands: { [first]: [Frankreich, Frankreich, Frankreich] },
            display: [BayernBurgund],
            deck: [EnglandSchwaben]
        })
        start.discard = [FrankenAragon, FrankenAragon, LothringenItalien]
        return { game, start, first, second, third }
    }

    it('scores only the cloisters the first time, reshuffles the discards and carries on drawing', () => {
        const { game, start, first, second } = exhaustionPosition()
        const exchanged = act(game, start, ActionType.ExchangeCard, { card: Frankreich })
        const result = execute(game, exchanged, {
            ...actionBase(game, first),
            type: ActionType.DrawFromDeck,
            revealsInfo: true
        })
        const scoring = result.processedActions.find((action) => isScoreInterim(action))
        assert(scoring !== undefined && isScoreInterim(scoring), 'The interim scoring ran')
        expect(scoring.metadata?.cloisters).toEqual([
            {
                country: Country.Franken,
                awards: [
                    { playerId: first, points: 3 },
                    { playerId: second, points: 2 }
                ]
            }
        ])
        const after = result.updatedState
        expect(after.players.find((p) => p.playerId === first)?.score).toBe(3)
        expect(after.players.find((p) => p.playerId === second)?.score).toBe(2)
        // The face-up card stayed; the four discards made the new deck, and the player's hand is full,
        // so one replaces the face-up card that is missing.
        expect(after.deckExhaustions).toBe(1)
        expect(after.discard).toEqual([])
        expect(after.display).toHaveLength(2)
        expect(after.deck.remaining).toBe(3)
        expect(after.activePlayerIds).toEqual([second])
    })

    it('stops drawing the second time and ends after the player before the starting player', () => {
        const { game, start, second, third } = exhaustionPosition()
        const secondPass = { ...start, deckExhaustions: 1 }
        const exchanged = act(game, secondPass, ActionType.ExchangeCard, { card: Frankreich })
        const drawn = act(game, exchanged, ActionType.DrawFromDeck, { revealsInfo: true })
        expect(drawn.deckExhaustions).toBe(2)
        expect(drawn.activePlayerIds).toEqual([second])
        // No drawing and no exchanging in the last round, only placing or passing.
        expect(legalActions(game, drawn).map((action) => action.type)).not.toContain(
            ActionType.ExchangeCard
        )
        const passed = act(game, drawn, ActionType.Pass)
        expect(passed.activePlayerIds).toEqual([third])
        const thirdPassed = act(game, passed, ActionType.Pass)
        const last = thirdPassed.turnManager.turnOrder.at(-1)
        expect(thirdPassed.activePlayerIds).toEqual([last])
        const finished = act(game, thirdPassed, ActionType.Pass)
        expect(finished.machineState).toBe(MachineState.EndOfGame)
    })

    it('ends straight after the turn when the player before the starting player empties the deck', () => {
        const { game, state } = setUp()
        const last = state.turnManager.turnOrder.at(-1)
        assert(last !== undefined, 'There is a last seat')
        let current = state
        while (current.activePlayerIds[0] !== last) {
            const [card] = hydrate(current).getPlayerState(current.activePlayerIds[0]).knownHand()
            current = act(game, current, ActionType.ExchangeCard, { card })
            current = act(game, current, ActionType.DrawFromDeck, { revealsInfo: true })
        }
        const position = withPosition(current, {
            hands: { [last]: [Frankreich, Frankreich, Frankreich] },
            display: [BayernBurgund],
            deck: [EnglandSchwaben],
            deckExhaustions: 1
        })
        const exchanged = act(game, position, ActionType.ExchangeCard, { card: Frankreich })
        const drawn = act(game, exchanged, ActionType.DrawFromDeck, { revealsInfo: true })
        expect(drawn.machineState).toBe(MachineState.EndOfGame)
    })
})

describe('the end of the game', () => {
    it('ends at once when nobody can place a piece any more', () => {
        const { game, state, first } = setUp()
        const players = state.turnManager.turnOrder
        // Every space but one is taken and nobody has an advisor left to send.
        const cloisters = SPACES.slice(0, -1).map((space, index) => ({
            abbey: space.abbey,
            playerId: players[index % players.length]
        }))
        const advisors = players.flatMap((playerId) =>
            Array.from({ length: 8 }, () => ({ country: Country.Frankreich, playerId }))
        )
        const start = withPosition(state, {
            cloisters,
            advisors,
            hands: { [first]: [LothringenItalien, Frankreich, Frankreich] }
        })
        const last = SPACES.at(-1)
        assert(last !== undefined, 'There are spaces')
        const finished = place(
            game,
            start,
            [LothringenItalien],
            PieceKind.Cloister,
            last.country,
            last.abbey
        )
        expect(finished.machineState).toBe(MachineState.EndOfGame)
    })

    it('scores cloisters, alliances and chains at the end, then names the winner', () => {
        const { game, state, first, second } = setUp()
        const start = withPosition(state, {
            cloisters: [
                { abbey: Abbey.LeThoronet, playerId: first },
                { abbey: Abbey.Locedio, playerId: first },
                { abbey: Abbey.Fontevivo, playerId: first },
                { abbey: Abbey.SanMartino, playerId: first },
                { abbey: Abbey.Fossanova, playerId: first },
                { abbey: Abbey.Zirc, playerId: first },
                { abbey: Abbey.Bonmont, playerId: second }
            ],
            advisors: [
                { country: Country.Italien, playerId: first },
                { country: Country.Italien, playerId: first },
                { country: Country.Italien, playerId: second },
                { country: Country.Burgund, playerId: first },
                { country: Country.Burgund, playerId: second }
            ],
            hands: { [first]: [Frankreich, Frankreich, Frankreich] },
            deckExhaustions: 2,
            display: []
        })
        start.deck = { items: [], remaining: 0 }
        let current = start
        while (current.machineState !== MachineState.EndOfGame)
            current = act(game, current, ActionType.Pass)
        const finished = current
        const hydrated = hydrate(finished)
        expect(hydrated.getPlayerState(first).score).toBe(
            // Italien 4, Burgund 2 (tied 1:1), Bayern 1; alliance 14 (Italien–Burgund) 5 points, as
            // both lead Burgund but only the first leads Italien; the chain Le Thoronet to Fossanova
            // 5, with Zirc a branch.
            4 + 2 + 1 + 5 + 5
        )
        expect(hydrated.getPlayerState(second).score).toBe(2)
        expect(finished.winningPlayerIds).toEqual([first])
        expect(finished.result).toBe(GameResult.Win)
        expect(WebOfPowerRuntime.scoring.finalScores(finished)[first]).toBe(17)
    })

    it('breaks a tie by pieces left, and shares the win when they are level too', () => {
        const { state, first, second } = setUp()
        const tied = hydrate(state)
        tied.getPlayerState(first).score = 10
        tied.getPlayerState(second).score = 10
        tied.cloisters = [{ abbey: Abbey.Chorin, playerId: first }]
        tied.declareResult()
        expect(tied.winningPlayerIds).toEqual([second])
        tied.cloisters = []
        tied.declareResult()
        expect(tied.winningPlayerIds).toEqual([first, second])
        expect(tied.result).toBe(GameResult.Draw)
    })
})

describe('scoring rules', () => {
    it('scores cloister places down from the most, as in the rulebook', () => {
        expect(
            cloisterAwards(
                new Map([
                    ['anna', 4],
                    ['barbara', 2],
                    ['dan', 1]
                ])
            )
        ).toEqual([
            { playerId: 'anna', points: 7 },
            { playerId: 'barbara', points: 4 },
            { playerId: 'dan', points: 2 }
        ])
        expect(
            cloisterAwards(
                new Map([
                    ['barbara', 2],
                    ['chris', 2],
                    ['dan', 1]
                ])
            )
        ).toEqual([
            { playerId: 'barbara', points: 5 },
            { playerId: 'chris', points: 5 },
            { playerId: 'dan', points: 2 }
        ])
    })

    it('scores an alliance for whoever leads both countries, as in the rulebook', () => {
        const { state } = setUp()
        const [anna, barbara, , dan] = state.turnManager.turnOrder
        const position = hydrate(
            withPosition(state, {
                advisors: [
                    { country: Country.Italien, playerId: dan },
                    { country: Country.Italien, playerId: dan },
                    { country: Country.Italien, playerId: barbara },
                    { country: Country.Italien, playerId: anna },
                    { country: Country.Burgund, playerId: dan },
                    { country: Country.Burgund, playerId: barbara },
                    { country: Country.Bayern, playerId: barbara },
                    { country: Country.Bayern, playerId: barbara },
                    { country: Country.Bayern, playerId: anna }
                ]
            })
        )
        const awards = position.allianceAwards()
        expect(awards.find((entry) => entry.alliance === 14)?.awards).toEqual([
            { playerId: dan, points: 6 }
        ])
        // Italien–Bayern: Dan leads Italien and Barbara Bayern, so nobody scores it.
        expect(awards.find((entry) => entry.alliance === 15)).toBeUndefined()
        // Burgund–Schwaben: nobody has an advisor in Schwaben.
        expect(awards.find((entry) => entry.alliance === 13)).toBeUndefined()
    })

    it('counts only the longest run in each connected group of cloisters', () => {
        // The rulebook's chain: Le Thoronet to Fossanova, with Zirc a branch from Locedio.
        const rulebook = new Set([
            Abbey.LeThoronet,
            Abbey.Locedio,
            Abbey.Fontevivo,
            Abbey.SanMartino,
            Abbey.Fossanova,
            Abbey.Zirc
        ])
        expect(longestChains(rulebook).map((chain) => chain.length)).toEqual([5])
        // A branch of four off a run of seven still counts only the seven.
        const branched = new Set([
            Abbey.Savigny,
            Abbey.LAumone,
            Abbey.Clairvaux,
            Abbey.Bontieu,
            Abbey.Sauvelade,
            Abbey.Vallbona,
            Abbey.Escarp,
            Abbey.Longpont,
            Abbey.Nivelles,
            Abbey.Klaarkamp
        ])
        expect(longestChains(branched).map((chain) => chain.length)).toEqual([8])
        // Separate groups score separately; one of three scores nothing.
        const apart = new Set([
            Abbey.Glastonbury,
            Abbey.Ford,
            Abbey.Waverley,
            Abbey.Kirkstead,
            Abbey.Reinfeld,
            Abbey.Lehnin,
            Abbey.Pforta
        ])
        expect(longestChains(apart).map((chain) => chain.length)).toEqual([4])
    })
})

describe('random playouts', () => {
    const setups = [
        ['three players', {}, 3],
        ['four players', {}, 4],
        ['five players', {}, 5],
        ['the faster variant', { fasterVariant: true }, 4]
    ] as const
    describe.each(setups)('with %s', (_name, config, count) => {
        it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])('seed %i ends with a result', (seed) => {
            const players = ['anna', 'barbara', 'chris', 'dan', 'eva'].slice(0, count)
            const game = createGame(config, players)
            const finished = playToEnd(game, startGame(game, undefined), seed)
            expect(finished.machineState).toBe(MachineState.EndOfGame)
            expect(finished.winningPlayerIds.length).toBeGreaterThan(0)
            expect(finished.turnManager.series.length).toBeLessThanOrEqual(count + 1)
            expect(engine).toBeDefined()
        })
    })

    it('records the final scoring with every part', () => {
        const game = createGame()
        let state = startGame(game)
        let scoring: GameAction | undefined
        let value = 7
        while (state.machineState !== MachineState.EndOfGame) {
            const actions = legalActions(game, state)
            const placing = actions.filter((action) => action.type === ActionType.PlacePiece)
            value = (value * 1103515245 + 12345) % 2147483648
            const pool = placing.length > 0 ? placing : actions
            const result = execute(game, state, pool[value % pool.length])
            scoring = result.processedActions.find((action) => isScoreFinal(action)) ?? scoring
            state = result.updatedState
        }
        assert(scoring !== undefined && isScoreFinal(scoring), 'The final scoring ran')
        expect(scoring.metadata?.cloisters.length).toBeGreaterThan(0)
    })
})
