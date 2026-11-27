import { tick } from 'svelte'
import type { Attachment } from 'svelte/attachments'
import { gsap } from 'gsap'
import type {
    AnimationContext,
    TransitionKind,
    TransitionStep
} from '@tabletop/frontend-components'
import {
    isScoreInterim,
    type CardColor,
    type HydratedWebOfPowerGameState
} from '@tabletop/web-of-power'
import type { MoveInterrupter, WebOfPowerGameSession } from '$lib/model/session.svelte.js'

// A page load, a sync with the server or a switch of view shows the cards as they are, unmoved.
const ANIMATED_KINDS: ReadonlySet<TransitionKind> = new Set<TransitionKind>([
    'own-action',
    'other-action',
    'undo',
    'history',
    'exploration'
])

const FLY = { duration: 0.45, stagger: 0.07, ease: 'power2.inOut' }
const QUICK = 0.18
// Another player's cards are not followed to their player card, which read as specks crossing the
// viewer's own hand: they drop onto, or lift off, their place like a piece.
const DROP = { duration: 0.3, rise: 1.2, scale: 1.15, show: 0.3 }
export const FAN_STEP = 8

type Step = TransitionStep<HydratedWebOfPowerGameState, AnimationContext>

export type CardPlace =
    | { kind: 'hand'; playerId: string; index?: number }
    | { kind: 'display'; index: number }
    | { kind: 'deck' }
    | { kind: 'discard' }

export type CardMove = { card?: CardColor; from: CardPlace; to: CardPlace }

export type Flier = {
    id: number
    card?: CardColor
    flips: boolean
    left: number
    top: number
    width: number
}

const othersHand = (place: CardPlace, me: string | undefined): boolean =>
    place.kind === 'hand' && place.playerId !== me

const placeName = (place: CardPlace, me: string | undefined): string => {
    switch (place.kind) {
        case 'hand':
            if (place.playerId !== me) return `player:${place.playerId}`
            return place.index === undefined ? 'hand' : `hand:${place.index}`
        case 'display':
            return `display:${place.index}`
        default:
            return place.kind
    }
}

// Read from the two states alone, so a move, its Undo and a history step move the same cards.
export function cardMoves(
    from: HydratedWebOfPowerGameState,
    to: HydratedWebOfPowerGameState,
    me: string | undefined
): CardMove[] {
    const moves: CardMove[] = []
    const actor = to.players.find(
        (player) => player.handCount !== from.getPlayerState(player.playerId).handCount
    )
    const handDelta = actor ? actor.handCount - from.getPlayerState(actor.playerId).handCount : 0
    const own = actor !== undefined && actor.playerId === me
    const fromHand = own ? [...(from.getPlayerState(actor.playerId).hand ?? [])] : []
    const toHand = own ? [...(actor.hand ?? [])] : []
    const takeFrom = (hand: (CardColor | undefined)[], card: CardColor | undefined) => {
        const index = card === undefined ? -1 : hand.indexOf(card)
        if (index < 0) return undefined
        hand[index] = undefined
        return index
    }
    const handPlace = (index?: number): CardPlace => ({
        kind: 'hand',
        playerId: actor?.playerId ?? '',
        index
    })

    // The interim scoring turns the whole discard pile into the deck: it moves as one pile, either
    // way, with any card the same step drew or gave back.
    const reshuffled =
        from.discard.length > 0 &&
        to.discard.length === 0 &&
        to.deck.remaining > from.deck.remaining
    const unshuffled =
        to.discard.length > 0 &&
        from.discard.length === 0 &&
        from.deck.remaining > to.deck.remaining
    if (reshuffled) {
        moves.push({ card: from.discard.at(-1), from: { kind: 'discard' }, to: { kind: 'deck' } })
    } else if (unshuffled) {
        moves.push({ card: to.discard.at(-1), from: { kind: 'deck' }, to: { kind: 'discard' } })
    }

    let handLeft = handDelta
    const pileMoved = reshuffled || unshuffled
    const discarded = pileMoved ? [] : to.discard.slice(from.discard.length)
    const undiscarded = pileMoved ? [] : from.discard.slice(to.discard.length)
    for (const card of discarded) {
        moves.push({ card, from: handPlace(takeFrom(fromHand, card)), to: { kind: 'discard' } })
        handLeft += 1
    }
    for (const card of undiscarded) {
        moves.push({ card, from: { kind: 'discard' }, to: handPlace(takeFrom(toHand, card)) })
        handLeft -= 1
    }

    const removed = leftOut(from.display, to.display)
    const added = leftOut(to.display, from.display)
    for (const { card, index } of removed) {
        if (handLeft > 0) {
            moves.push({
                card,
                from: { kind: 'display', index },
                to: handPlace(takeFrom(toHand, card))
            })
            handLeft -= 1
        } else {
            moves.push({ card, from: { kind: 'display', index }, to: { kind: 'deck' } })
        }
    }
    for (const { card, index } of added) {
        if (handLeft < 0) {
            moves.push({
                card,
                from: handPlace(takeFrom(fromHand, card)),
                to: { kind: 'display', index }
            })
            handLeft += 1
        } else {
            moves.push({ card, from: { kind: 'deck' }, to: { kind: 'display', index } })
        }
    }

    for (; handLeft > 0; handLeft--) {
        const card = own
            ? toHand.find((held) => held !== undefined && !fromHand.includes(held))
            : undefined
        moves.push({ card, from: { kind: 'deck' }, to: handPlace(takeFrom(toHand, card)) })
    }
    for (; handLeft < 0; handLeft++) {
        const card = own
            ? fromHand.find((held) => held !== undefined && !toHand.includes(held))
            : undefined
        moves.push({ card, from: handPlace(takeFrom(fromHand, card)), to: { kind: 'deck' } })
    }
    return moves
}

function matchUp(earlier: readonly CardColor[], later: readonly CardColor[]): [number, number][] {
    const free = later.map((card, index) => ({ card, index }))
    const pairs: [number, number][] = []
    earlier.forEach((card, index) => {
        const match = free.findIndex((candidate) => candidate.card === card)
        if (match < 0) return
        pairs.push([index, free[match].index])
        free.splice(match, 1)
    })
    return pairs
}

function leftOut(cards: readonly CardColor[], others: readonly CardColor[]) {
    const unmatched = [...others]
    const out: { card: CardColor; index: number }[] = []
    cards.forEach((card, index) => {
        const match = unmatched.indexOf(card)
        if (match >= 0) unmatched.splice(match, 1)
        else out.push({ card, index })
    })
    return out
}

export type CardTable = {
    hand: CardColor[]
    display: CardColor[]
    discard: CardColor[]
    deckCount: number
}

function tableOf(state: HydratedWebOfPowerGameState, me: string | undefined): CardTable {
    return {
        hand: me === undefined ? [] : [...(state.getPlayerState(me).hand ?? [])],
        display: [...state.display],
        discard: [...state.discard],
        deckCount: state.deck.remaining
    }
}

export class CardAnimator implements MoveInterrupter {
    fliers: Flier[] = $state.raw([])
    // A move and its system actions play before the visible state catches up.
    table: CardTable = $derived.by(() => tableOf(this.session.gameState, this.session.myPlayer?.id))

    private readonly places = new Map<string, Set<HTMLElement>>()
    private readonly flierNodes = new Map<number, HTMLElement>()
    private readonly listener = (step: Step) => this.onGameStateChange(step)
    private readonly tweened = new Set<object>()
    private landMove: (() => void) | undefined
    private timeline: gsap.core.Timeline | undefined
    private abandoned: HydratedWebOfPowerGameState | undefined
    private nextId = 1

    constructor(private readonly session: WebOfPowerGameSession) {}

    readonly attach: Attachment = () => {
        this.session.addGameStateChangeListener(this.listener)
        this.session.moveInterrupters.add(this)
        return () => {
            this.session.removeGameStateChangeListener(this.listener)
            this.session.moveInterrupters.delete(this)
            this.stop()
        }
    }

    interrupt() {
        this.stop()
    }

    // Even between steps: the rest of the replay is still to come.
    abandon() {
        this.stop()
        this.abandoned = this.session.presentingState
    }

    // The tray is drawn twice in full screen; the one on view is used.
    place(name: string): Attachment<HTMLElement> {
        return (node) => {
            const nodes = this.places.get(name) ?? new Set<HTMLElement>()
            nodes.add(node)
            this.places.set(name, nodes)
            return () => {
                nodes.delete(node)
                if (nodes.size === 0) this.places.delete(name)
            }
        }
    }

    flier(id: number): Attachment<HTMLElement> {
        return (node) => {
            this.flierNodes.set(id, node)
            return () => {
                if (this.flierNodes.get(id) === node) this.flierNodes.delete(id)
            }
        }
    }

    private stop(): boolean {
        const land = this.landMove
        if (land === undefined) return false
        this.timeline?.kill()
        gsap.killTweensOf([...this.tweened])
        land()
        return true
    }

    private async onGameStateChange(step: Step) {
        try {
            await this.present(step)
        } catch (error) {
            this.fliers = []
            this.table = tableOf(this.session.gameState, this.session.myPlayer?.id)
            throw error
        }
    }

    private rectOf(name: string): DOMRect | undefined {
        for (const node of this.places.get(name) ?? []) {
            const rect = node.getBoundingClientRect()
            if (rect.width > 0 && node.isConnected) return rect
        }
        return undefined
    }

    private nodeOf(name: string): HTMLElement | undefined {
        for (const node of this.places.get(name) ?? []) {
            if (node.getBoundingClientRect().width > 0) return node
        }
        return undefined
    }

    private async present({ kind, to, from, action, animationContext }: Step) {
        if (from === undefined || !ANIMATED_KINDS.has(kind)) return
        const presenting = this.session.presentingState
        if (presenting !== undefined && presenting === this.abandoned) return
        this.abandoned = undefined
        const me = this.session.myPlayer?.id
        const moves = cardMoves(from, to, me)
        const shown = this.session.gameState
        const before = this.table
        const after = tableOf(to, me)
        if (moves.length === 0) {
            animationContext.afterAnimations(() => {
                if (this.session.gameState === shown) this.table = after
            })
            return
        }
        const quick = action === undefined
        const duration = quick ? QUICK : FLY.duration

        // A card from another player's hand is placed exactly once the new state shows.
        const starts = moves.map((move) =>
            othersHand(move.from, me)
                ? (this.rectOf(placeName(move.to, me)) ?? this.rectOf('deck'))
                : this.rectOf(placeName(move.from, me))
        )
        const handBefore = this.rectsOf('hand', before.hand.length)
        const rowBefore = this.rectsOf('display', before.display.length)
        const width = this.cardWidth()

        // A pile counts an arriving card only once it lands, and lets one go as its timeline starts.
        this.table = {
            hand: after.hand,
            display: after.display,
            discard: before.discard,
            deckCount: Math.min(before.deckCount, after.deckCount)
        }
        const fliers = moves.flatMap((move, order) => {
            const start = starts[order]
            if (start === undefined) return []
            return [
                {
                    id: this.nextId++,
                    card: move.card,
                    flips: move.from.kind === 'deck' && move.card !== undefined,
                    left: start.left + start.width / 2 - width / 2,
                    top: start.top + start.height / 2 - (width * 1.5) / 2,
                    width,
                    move
                }
            ]
        })
        this.fliers = fliers.map(({ id, card, flips, left, top, width }) => ({
            id,
            card,
            flips,
            left,
            top,
            width
        }))
        await tick()

        const timeline = gsap.timeline()
        // The interim scoring reshuffles once its points are counted: after the scoring's beats.
        const owner = isScoreInterim(action)
            ? animationContext.finalTimeline
            : animationContext.actionTimeline
        owner.add(timeline, 0)
        this.timeline = timeline
        if (after.discard.length < before.discard.length) {
            timeline.call(
                () => {
                    if (this.session.gameState === shown) {
                        this.table = { ...this.table, discard: after.discard }
                    }
                },
                undefined,
                0
            )
        }
        const touched: HTMLElement[] = []
        const slide = (node: HTMLElement, from: DOMRect, to: DOMRect, turn = 0) => {
            const x = from.left + from.width / 2 - (to.left + to.width / 2)
            const y = from.top + from.height / 2 - (to.top + to.height / 2)
            if (Math.abs(x) < 0.5 && Math.abs(y) < 0.5 && turn === 0) return
            touched.push(node)
            this.tweened.add(node)
            timeline.fromTo(
                node,
                { x, y, rotation: turn },
                {
                    x: 0,
                    y: 0,
                    rotation: 0,
                    duration,
                    ease: quick ? 'power1.inOut' : 'power2.inOut',
                    immediateRender: true
                },
                0
            )
        }
        const fan = (count: number) => (index: number) => (index - (count - 1) / 2) * FAN_STEP
        for (const [index, later] of matchUp(before.hand, after.hand)) {
            const node = this.nodeOf(`hand:${later}`)
            const from = handBefore[index]
            if (node === undefined || from === undefined) continue
            const turn = fan(before.hand.length)(index) - fan(after.hand.length)(later)
            slide(node, from, node.getBoundingClientRect(), turn)
        }
        for (const [index, later] of matchUp(before.display, after.display)) {
            const node = this.nodeOf(`display:${later}`)
            const from = rowBefore[index]
            if (node === undefined || from === undefined) continue
            slide(node, from, node.getBoundingClientRect())
        }

        fliers.forEach((flier, order) => {
            const node = this.flierNodes.get(flier.id)
            if (node === undefined) throw Error('A flying card is drawn before it flies')
            this.tweened.add(node)
            const at = quick ? 0 : order * FLY.stagger
            const fade = quick ? QUICK : DROP.duration
            const rise = width * DROP.rise
            if (othersHand(flier.move.to, me)) {
                timeline.fromTo(
                    node,
                    { y: 0, scale: 1 },
                    {
                        y: -rise,
                        scale: DROP.scale,
                        duration: fade,
                        ease: 'power1.in',
                        immediateRender: true
                    },
                    at
                )
                timeline.fromTo(
                    node,
                    { opacity: 1 },
                    {
                        opacity: 0,
                        duration: fade * DROP.show,
                        ease: 'none',
                        immediateRender: false
                    },
                    at + fade * (1 - DROP.show)
                )
                return
            }
            const name = placeName(flier.move.to, me)
            const arriving =
                flier.move.to.kind === 'display' ||
                (flier.move.to.kind === 'hand' && flier.move.to.playerId === me)
                    ? this.nodeOf(name)
                    : undefined
            const end = arriving?.getBoundingClientRect() ?? this.rectOf(name)
            if (end === undefined) return
            const travel = othersHand(flier.move.from, me) ? fade : duration
            if (arriving !== undefined) {
                touched.push(arriving)
                arriving.style.visibility = 'hidden'
                timeline.call(() => (arriving.style.visibility = ''), undefined, at + travel)
            }
            const x = end.left + end.width / 2 - (flier.left + width / 2)
            const y = end.top + end.height / 2 - (flier.top + (width * 1.5) / 2)
            const spin = node.querySelector<HTMLElement>('.spin')
            if (flier.flips && spin !== null) {
                this.tweened.add(spin)
                timeline.fromTo(
                    spin,
                    { rotationY: 0 },
                    {
                        rotationY: 180,
                        duration: duration * 0.6,
                        ease: 'power1.inOut',
                        immediateRender: true
                    },
                    at + duration * 0.2
                )
            }
            const lands =
                flier.move.to.kind === 'hand' && flier.move.to.playerId === me
                    ? fan(after.hand.length)(flier.move.to.index ?? after.hand.length - 1)
                    : 0
            if (flier.move.to.kind === 'deck' || flier.move.to.kind === 'discard') {
                timeline.call(
                    () => {
                        node.style.visibility = 'hidden'
                        if (this.session.gameState === shown) {
                            this.table = {
                                ...this.table,
                                discard: after.discard,
                                deckCount: after.deckCount
                            }
                        }
                    },
                    undefined,
                    at + travel
                )
            }
            if (othersHand(flier.move.from, me)) {
                timeline.fromTo(
                    node,
                    { x, y: y - rise, scale: DROP.scale },
                    { y, scale: 1, duration: fade, ease: 'power1.out', immediateRender: true },
                    at
                )
                timeline.fromTo(
                    node,
                    { opacity: 0 },
                    { opacity: 1, duration: fade * DROP.show, ease: 'none', immediateRender: true },
                    at
                )
                return
            }
            timeline.fromTo(
                node,
                { x: 0, y: 0, rotation: 0 },
                {
                    x,
                    y,
                    rotation: lands,
                    duration,
                    ease: quick ? 'power1.inOut' : FLY.ease,
                    immediateRender: true
                },
                at
            )
        })

        const land = () => {
            if (this.landMove === land) this.landMove = undefined
            if (this.timeline === timeline) this.timeline = undefined
            this.tweened.clear()
            for (const node of touched) {
                node.style.visibility = ''
                gsap.set(node, { clearProps: 'transform' })
            }
            this.fliers = []
            // A switch of view mid-move has already shown another state, which must not be covered.
            if (this.session.gameState === shown) this.table = after
        }
        this.landMove = land
        animationContext.afterAnimations(land)
    }

    private rectsOf(name: 'hand' | 'display', count: number): (DOMRect | undefined)[] {
        return Array.from({ length: count }, (_, index) => this.rectOf(`${name}:${index}`))
    }

    private cardWidth(): number {
        for (const name of ['deck', 'discard', 'hand:0', 'display:0']) {
            const rect = this.rectOf(name)
            if (rect !== undefined) return rect.width
        }
        return 54
    }
}
