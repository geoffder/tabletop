import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { flushSync } from 'svelte'
import {
    ActionSource,
    GameStorage,
    type Game,
    type GameAction,
    type GameState,
    type HydratedGameState
} from '@tabletop/common'
import {
    BridgedContext,
    GameSession,
    createHarnessAppContext,
    type GameUiDefinition
} from '@tabletop/frontend-components'
import type { GameUIRuntime } from '@tabletop/frontend-components/definition/gameUiDefinition'
import {
    ActionType,
    Country,
    PieceKind,
    WebOfPowerRuntime,
    type HydratedWebOfPowerGameState,
    type WebOfPowerProjectedState
} from '@tabletop/web-of-power'
import { WebOfPowerGameColorizer } from '$lib/definitions/colorizer.js'
import { UiDefinition } from '$lib/definitions/definition.js'
import { cardMoves } from '$lib/animators/cardAnimator.svelte.js'
import { WebOfPowerGameSession } from './session.svelte.js'

const HARNESS_USER = 'harness-user'
const ALICE = 'player-1'
const BOB = 'player-2'

const gameUI = {
    load: async () => {
        throw Error('The session spec does not render a table')
    },
    mount: () => {
        throw Error('The session spec does not render a table')
    }
}

const runtime: GameUIRuntime<WebOfPowerProjectedState, HydratedWebOfPowerGameState> = {
    ...WebOfPowerRuntime,
    sessionClass: WebOfPowerGameSession,
    colorizer: new WebOfPowerGameColorizer(),
    gameUI
}

const definition: GameUiDefinition<GameState, HydratedGameState> = {
    info: UiDefinition.info,
    async runtime() {
        return {
            ...WebOfPowerRuntime,
            sessionClass: GameSession,
            colorizer: runtime.colorizer,
            gameUI
        }
    }
}

// Built from this file's path: the client build Vitest runs turns new URL(..., import.meta.url)
// into an asset lookup.
const SCENARIOS = join(dirname(fileURLToPath(import.meta.url)), '../../scenarios')

// A harness scenario (Late game unless named), Alice to play, with the harness user in her seat.
function scenarioGame(file = 'late-game.json') {
    const scenario = JSON.parse(readFileSync(join(SCENARIOS, file), 'utf8'))
    const game: Game = {
        ...scenario.game,
        storage: GameStorage.Local,
        players: scenario.game.players.map((player: { id: string }) => ({
            ...player,
            userId: player.id === ALICE ? HARNESS_USER : `someone-${player.id}`
        }))
    }
    const actions: GameAction[] = scenario.actions
    return { game, state: scenario.state, actions }
}

// The client build's window is Node's global, which has no events; the session's preferences
// listen for focus.
vi.stubGlobal('addEventListener', () => {})
vi.stubGlobal('removeEventListener', () => {})

const disposals: (() => void)[] = []
afterEach(() => {
    for (const dispose of disposals.splice(0)) dispose()
})

let current: WebOfPowerGameSession

async function aliceSession(file?: string) {
    const { game, state, actions } = scenarioGame(file)
    const app = createHarnessAppContext(definition)
    vi.spyOn(app.gameService, 'saveGameLocally').mockResolvedValue(undefined)
    const bridgedContext = new BridgedContext({
        authorizationService: app.authorizationService,
        gameService: app.gameService,
        chatService: app.chatService,
        gameId: game.id
    })
    const session = new WebOfPowerGameSession({
        gameService: app.gameService,
        bridgedContext,
        notificationService: app.notificationService,
        chatService: app.chatService,
        api: app.api,
        runtime,
        game,
        state,
        actions
    })
    disposals.push(() => {
        session.dispose()
        bridgedContext.dispose()
    })
    flushSync()
    current = session
    await session.waitForVisibleTransitionSettled()
    return session
}

// A move or Undo has landed once the session has shown the state it leads to and history has let
// go of the step, on a timer.
async function settled(change: Promise<unknown>) {
    await change
    await current.waitForVisibleTransitionSettled()
    await new Promise((resolve) => setTimeout(resolve))
}

function pairIndices(hand: readonly string[]): [number, number] {
    const second = hand.findIndex((card, index) => hand.indexOf(card) !== index)
    if (second < 0) throw Error('The hand holds a pair')
    return [hand.indexOf(hand[second]), second]
}

async function placeFirstTarget(session: WebOfPowerGameSession) {
    const [target] = session.targets
    if (target === undefined) throw Error('The chosen cards have somewhere to go')
    await settled(session.placeAt(target))
}

describe('Choosing cards', () => {
    it('offers the cards that can pay, and lights where the chosen one goes', async () => {
        const session = await aliceSession()
        expect(session.placeableIndices.size).toBeGreaterThan(0)
        const [index] = session.placeableIndices
        session.chooseCard(index)
        expect(session.chosenCards).toEqual([session.hand[index]])
        expect(session.targets.length).toBeGreaterThan(0)
        for (const target of session.targets) {
            expect(session.chosenCountries).toContain(target.country)
        }
    })

    it('lets go on a second tap, a tap off, or Undo', async () => {
        const session = await aliceSession()
        const [index] = session.placeableIndices
        session.chooseCard(index)
        session.chooseCard(index)
        expect(session.chosenCards).toEqual([])
        session.chooseCard(index)
        session.letGo()
        expect(session.chosenCards).toEqual([])
        session.chooseCard(index)
        await settled(session.undo())
        expect(session.chosenCards).toEqual([])
    })

    it('makes a joker of a pair, placing in any country, and Undo lets go of it first', async () => {
        const session = await aliceSession()
        const [first, second] = pairIndices(session.hand)
        session.chooseCard(first)
        session.chooseCard(second)
        expect(session.chosenCards).toHaveLength(2)
        expect(session.chosenCountries).toHaveLength(9)
        expect(session.canExchangeChosen).toBe(false)
        await settled(session.undo())
        expect(session.chosenCards).toHaveLength(1)
    })

    it('chooses a card of another colour alone', async () => {
        const session = await aliceSession()
        const [first, second] = pairIndices(session.hand)
        const other = session.hand.findIndex((card) => card !== session.hand[first])
        session.chooseCard(first)
        session.chooseCard(second)
        session.chooseCard(other)
        expect(session.chosenCards).toEqual([session.hand[other]])
    })
})

describe('Placing and drawing', () => {
    it('places where offered, ignoring a place not offered and taps while a move plays', async () => {
        const session = await aliceSession()
        const [index] = session.placeableIndices
        session.chooseCard(index)
        const before = session.gameState.actionCount
        const elsewhere = Object.values(Country).find(
            (country) => !session.chosenCountries.includes(country)
        )
        if (elsewhere === undefined) throw Error('A single card names two countries')
        await session.placeAt({ kind: PieceKind.Advisor, country: elsewhere })
        expect(session.gameState.actionCount).toBe(before)
        session.updatingVisibleState = true
        await session.placeAt(session.targets[0])
        session.updatingVisibleState = false
        expect(session.gameState.actionCount).toBe(before)

        await placeFirstTarget(session)
        expect(session.gameState.actionCount).toBe(before + 1)
        expect(session.hand).toHaveLength(2)
        expect(session.canEndPlacing).toBe(true)
        expect(session.canExchange).toBe(false)
    })

    it('draws as many cards as it placed pieces', async () => {
        const session = await aliceSession()
        for (let piece = 0; piece < 2; piece++) {
            session.chooseCard([...session.placeableIndices][0])
            await placeFirstTarget(session)
        }
        expect(session.isDrawing).toBe(true)
        expect(session.cardsToDraw).toBe(2)
        await settled(session.drawFaceUp(session.gameState.display[0]))
        expect(session.cardsToDraw).toBe(1)
    })

    it('offers nothing while history is viewed', async () => {
        const session = await aliceSession()
        session.chooseCard([...session.placeableIndices][0])
        await placeFirstTarget(session)
        await settled(session.history.goToPreviousAction())
        expect(session.isViewingHistory).toBe(true)
        expect(session.canChooseCards).toBe(false)
        expect(session.placeableIndices.size).toBe(0)
        expect(session.targets).toEqual([])
    })
})

describe('History steps', () => {
    const action = (type: ActionType, source: ActionSource): GameAction => ({
        id: type,
        gameId: 'game',
        type,
        source
    })

    it('take a move with the system actions after it, not the move after those', async () => {
        const session = await aliceSession()
        const draw = action(ActionType.DrawFromDeck, ActionSource.User)
        const refill = action(ActionType.RefillDisplay, ActionSource.System)
        const place = action(ActionType.PlacePiece, ActionSource.User)
        expect(session.shouldAutoStepAction(draw, refill)).toBe(true)
        expect(session.shouldAutoStepAction(refill, place)).toBe(false)
        expect(session.shouldAutoStepAction(place)).toBe(false)
    })
})

describe('cardMoves', () => {
    it("follows the viewer's own card to the discard and another player's card off the deck unseen", async () => {
        const session = await aliceSession()
        const index = [...session.placeableIndices][0]
        const card = session.hand[index]
        session.chooseCard(index)
        const before = session.gameState
        await placeFirstTarget(session)
        expect(cardMoves(before, session.gameState, ALICE)).toEqual([
            { card, from: { kind: 'hand', playerId: ALICE, index }, to: { kind: 'discard' } }
        ])

        session.chooseCard([...session.placeableIndices][0])
        await placeFirstTarget(session)
        const drawing = session.gameState
        await settled(session.drawFromDeck())
        expect(cardMoves(drawing, session.gameState, BOB)).toEqual([
            { card: undefined, from: { kind: 'deck' }, to: { kind: 'hand', playerId: ALICE } }
        ])
    })

    it('moves the reshuffled pile once, and the drawn card, across the interim scoring', async () => {
        const session = await aliceSession('interim-scoring.json')
        session.chooseCard([...session.placeableIndices][0])
        await placeFirstTarget(session)
        if (session.canEndPlacing) await settled(session.endPlacing())
        const drawing = session.gameState
        const held = [...session.hand]
        await settled(session.drawFromDeck())
        const scored = session.gameState
        expect(scored.discard).toHaveLength(0)
        const drawn = session.hand.find((card) => {
            const kept = held.indexOf(card)
            if (kept >= 0) held.splice(kept, 1)
            return kept < 0
        })
        if (drawn === undefined) throw Error('The draw adds a card to the hand')
        const index = session.hand.indexOf(drawn)
        const pile = drawing.discard.at(-1)

        expect(cardMoves(drawing, scored, ALICE)).toEqual([
            { card: pile, from: { kind: 'discard' }, to: { kind: 'deck' } },
            { card: drawn, from: { kind: 'deck' }, to: { kind: 'hand', playerId: ALICE, index } }
        ])
        expect(cardMoves(scored, drawing, ALICE)).toEqual([
            { card: pile, from: { kind: 'deck' }, to: { kind: 'discard' } },
            { card: drawn, from: { kind: 'hand', playerId: ALICE, index }, to: { kind: 'deck' } }
        ])
    })
})
