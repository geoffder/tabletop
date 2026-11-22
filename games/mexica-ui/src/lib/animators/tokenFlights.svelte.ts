import { getContext, setContext, tick } from 'svelte'
import type { Attachment } from 'svelte/attachments'
import { gsap } from 'gsap'
import type {
    AnimationContext,
    TransitionKind,
    TransitionStep
} from '@tabletop/frontend-components'
import type { HydratedMexicaGameState } from '@tabletop/mexica'
import type { MexicaGameSession, MoveInterrupter } from '$lib/model/session.svelte.js'

// An action token taken flies as its mask from the supply tray on the board to the player's card;
// one spent, or a take undone, flies back. The mask lifts, arcs over and drops into place, a
// little larger at the top of its arc.

const ANIMATED_KINDS: ReadonlySet<TransitionKind> = new Set<TransitionKind>([
    'own-action',
    'other-action',
    'undo',
    'history',
    'exploration'
])

// Seconds: a flight with an action, one without, and the gap between two masks flying together.
const FLIGHT = 0.6
const QUICK = 0.18
const STAGGER = 0.08
// Pixels the arc rises above the straight path, at most and as a share of its length, and how
// much the mask swells at its top.
const ARC = { most: 70, share: 0.3, swell: 0.25 }
// How far inside the screen's edge a card off it is met.
const EDGE = 14

type Step = TransitionStep<HydratedMexicaGameState, AnimationContext>

// A mask in flight: where it sets off and lands, centres and sizes in screen pixels.
export type Flier = { id: number; from: Spot; to: Spot }
type Spot = { x: number; y: number; size: number }

const KEY = Symbol('mexica-token-flights')

export function setTokenFlights(flights: TokenFlights) {
    setContext(KEY, flights)
}

export function getTokenFlights(): TokenFlights | undefined {
    return getContext<TokenFlights | undefined>(KEY)
}

export class TokenFlights implements MoveInterrupter {
    fliers: readonly Flier[] = $state.raw([])

    private supply: Element | undefined
    private readonly cards = new Map<string, Element>()
    private readonly nodes = new Map<number, HTMLElement>()
    private readonly listener = (step: Step) => this.onGameStateChange(step)
    private readonly tweened = new Set<object>()
    private made = 0

    constructor(private readonly session: MexicaGameSession) {}

    readonly attach: Attachment = () => {
        this.session.addGameStateChangeListener(this.listener)
        this.session.moveInterrupters.add(this)
        return () => {
            this.session.removeGameStateChangeListener(this.listener)
            this.session.moveInterrupters.delete(this)
            this.land()
        }
    }

    // The masks fly over the page, which a change of the board's view leaves where it was.
    interrupt() {}

    abandon() {
        this.land()
    }

    // The supply tray's mask on the board.
    readonly supplyMask: Attachment<Element> = (node) => {
        this.supply = node
        return () => {
            if (this.supply === node) this.supply = undefined
        }
    }

    // A player's tokens on their card.
    cardMask(playerId: string): Attachment<Element> {
        return (node) => {
            this.cards.set(playerId, node)
            return () => {
                if (this.cards.get(playerId) === node) this.cards.delete(playerId)
            }
        }
    }

    flier(id: number): Attachment<HTMLElement> {
        return (node) => {
            this.nodes.set(id, node)
            return () => {
                if (this.nodes.get(id) === node) this.nodes.delete(id)
            }
        }
    }

    private async onGameStateChange({ kind, from, to, action, animationContext }: Step) {
        if (from === undefined || !ANIMATED_KINDS.has(kind)) return
        const supply = this.spotOf(this.supply)
        if (supply === undefined) return
        const flights: { from: Spot; to: Spot }[] = []
        for (const player of to.players) {
            const card = this.spotOf(this.cards.get(player.playerId))
            if (card === undefined) continue
            const change = player.actionTokens - from.getPlayerState(player.playerId).actionTokens
            for (let n = 0; n < Math.abs(change); n++) {
                flights.push(change > 0 ? { from: supply, to: card } : { from: card, to: supply })
            }
        }
        if (flights.length === 0) return

        this.fliers = flights.map((flight) => ({ id: this.made++, ...flight }))
        await tick()
        const quick = action === undefined
        const timeline = animationContext.actionTimeline
        for (const [index, flier] of this.fliers.entries()) {
            const node = this.nodes.get(flier.id)
            if (node === undefined) continue
            this.fly(node, flier, quick, timeline, index * (quick ? 0 : STAGGER))
        }
        animationContext.afterAnimations(() => this.land())
    }

    private fly(
        node: HTMLElement,
        { from, to }: Flier,
        quick: boolean,
        timeline: gsap.core.Timeline,
        at: number
    ) {
        const dx = to.x - from.x
        const dy = to.y - from.y
        const arc = quick ? 0 : Math.min(ARC.most, Math.hypot(dx, dy) * ARC.share)
        const progress = { u: 0 }
        const write = () => {
            const u = progress.u
            const x = from.x + dx * u
            const y = from.y + dy * u - arc * 4 * u * (1 - u)
            const size = from.size + (to.size - from.size) * u
            const swell = quick ? 1 : 1 + ARC.swell * 4 * u * (1 - u)
            node.style.transform = `translate(${x - size / 2}px, ${y - size / 2}px)`
            node.style.width = `${size * swell}px`
            node.style.height = `${size * swell}px`
            node.style.marginLeft = `${(-size * (swell - 1)) / 2}px`
            node.style.marginTop = `${(-size * (swell - 1)) / 2}px`
        }
        write()
        this.tweened.add(progress)
        timeline.to(
            progress,
            {
                u: 1,
                duration: quick ? QUICK : FLIGHT,
                ease: quick ? 'power1.out' : 'power1.inOut',
                onUpdate: write
            },
            at
        )
    }

    private land() {
        gsap.killTweensOf([...this.tweened])
        this.tweened.clear()
        this.fliers = []
    }

    // The centre and size of a mask on screen; a card scrolled off the screen, as on a phone, is
    // met at the screen's edge beside it.
    private spotOf(node: Element | undefined): Spot | undefined {
        if (node === undefined || !node.isConnected) return undefined
        const rect = node.getBoundingClientRect()
        if (rect.width === 0) return undefined
        const clamp = (value: number, most: number) => Math.min(Math.max(value, EDGE), most - EDGE)
        return {
            x: clamp(rect.left + rect.width / 2, window.innerWidth),
            y: clamp(rect.top + rect.height / 2, window.innerHeight),
            size: Math.max(rect.width, rect.height)
        }
    }
}
