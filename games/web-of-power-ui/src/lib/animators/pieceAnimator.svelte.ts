import { tick } from 'svelte'
import type { Attachment } from 'svelte/attachments'
import { gsap } from 'gsap'
import type {
    AnimationContext,
    TransitionKind,
    TransitionStep
} from '@tabletop/frontend-components'
import type {
    Advisor,
    Cloister,
    Country,
    HydratedWebOfPowerGameState
} from '@tabletop/web-of-power'
import type { MoveInterrupter, WebOfPowerGameSession } from '$lib/model/session.svelte.js'
import { advisorSpots } from '$lib/board/advisorSpots.js'
import { poseOf, setPose } from './svgPose.js'

// A page load, a sync with the server or a switch of view shows the board as it is, unmoved.
const ANIMATED_KINDS: ReadonlySet<TransitionKind> = new Set<TransitionKind>([
    'own-action',
    'other-action',
    'undo',
    'history',
    'exploration'
])

const DROP = { rise: -38, fall: 0.26, bounce: -4, settle: 0.14 }
const SLIDE = 0.3
const LIFT_OFF = { rise: -30 }
const QUICK = 0.18
// While a move drops a piece, a phone's stall counts as one ordinary frame, so the drop runs late
// but whole (GSAP would otherwise jump over it); GSAP's default is put back as the move lands.
const STALL = { threshold: 100, frame: 33 }
const GSAP_STALL = { threshold: 500, frame: 33 }
const DRAW_WAIT = 0.01

type Timeline = gsap.core.Timeline
type Step = TransitionStep<HydratedWebOfPowerGameState, AnimationContext>

const owned = (pieces: readonly { playerId: string }[], playerId: string) =>
    pieces.filter((piece) => piece.playerId === playerId).length

export const advisorKey = (country: Country, index: number) => `${country}:${index}`

export class PieceAnimator implements MoveInterrupter {
    // A replay plays several actions before the visible state catches up.
    cloisters: Cloister[] = $derived.by(() => this.session.gameState.cloisters)
    advisors: Advisor[] = $derived.by(() => this.session.gameState.advisors)
    // While a peg lifts off, the others still stand in the ring it leaves.
    ringSizes: ReadonlyMap<Country, number> = $derived.by(() => {
        void this.session.gameState
        return new Map<Country, number>()
    })

    cloistersLeft(playerId: string): number {
        const state = this.session.gameState
        return (
            state.cloistersLeft(playerId) +
            owned(state.cloisters, playerId) -
            owned(this.cloisters, playerId)
        )
    }

    advisorsLeft(playerId: string): number {
        const state = this.session.gameState
        return (
            state.advisorsLeft(playerId) +
            owned(state.advisors, playerId) -
            owned(this.advisors, playerId)
        )
    }

    private readonly houses = new Map<string, SVGGElement>()
    private readonly pegs = new Map<string, SVGGElement>()
    private readonly listener = (step: Step) => this.onGameStateChange(step)
    private readonly tweened = new Set<object>()
    private landMove: (() => void) | undefined
    private timeline: Timeline | undefined
    private abandoned: HydratedWebOfPowerGameState | undefined

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

    abandon() {
        if (this.stop()) this.abandoned = this.session.presentingState
    }

    house(abbey: string): Attachment<SVGGElement> {
        return (node) => {
            this.houses.set(abbey, node)
            return () => {
                if (this.houses.get(abbey) === node) this.houses.delete(abbey)
            }
        }
    }

    peg(key: string): Attachment<SVGGElement> {
        return (node) => {
            this.pegs.set(key, node)
            return () => {
                if (this.pegs.get(key) === node) this.pegs.delete(key)
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
            gsap.ticker.lagSmoothing(GSAP_STALL.threshold, GSAP_STALL.frame)
            this.cloisters = this.session.gameState.cloisters
            this.advisors = this.session.gameState.advisors
            this.ringSizes = new Map()
            throw error
        }
    }

    private async present({ kind, to, from, action, animationContext }: Step) {
        if (from === undefined || !ANIMATED_KINDS.has(kind)) return
        const presenting = this.session.presentingState
        if (presenting !== undefined && presenting === this.abandoned) return
        this.abandoned = undefined
        const shown = this.session.gameState
        const quick = action === undefined

        const before = new Set(from.cloisters.map((cloister) => cloister.abbey))
        const after = new Set(to.cloisters.map((cloister) => cloister.abbey))
        const placed = to.cloisters.filter((cloister) => !before.has(cloister.abbey))
        const lifted = from.cloisters.filter((cloister) => !after.has(cloister.abbey))
        const changes = this.advisorChanges(from, to)
        if (placed.length === 0 && lifted.length === 0 && changes.length === 0) return

        this.cloisters = [...from.cloisters, ...placed]
        const advisorsOf = (state: HydratedWebOfPowerGameState, country: Country) =>
            state.advisors.filter((advisor) => advisor.country === country)
        const changed = new Set(changes.map(({ country }) => country))
        this.advisors = [
            ...to.advisors.filter((advisor) => !changed.has(advisor.country)),
            ...changes.flatMap(({ country, before, after }) =>
                advisorsOf(after >= before ? to : from, country)
            )
        ]
        this.ringSizes = new Map(
            changes
                .filter(({ before, after }) => after < before)
                .map(({ country, before }) => [country, before])
        )
        const dropping = !quick && (placed.length > 0 || changes.some((c) => c.after > c.before))
        if (dropping) gsap.ticker.lagSmoothing(STALL.threshold, STALL.frame)
        const drawing = performance.now()
        await tick()
        // The context's timelines run from the moment it is made, just before this listener.
        const timeline = gsap.timeline()
        const wait = Math.min(DRAW_WAIT, (performance.now() - drawing) / 1000)
        animationContext.actionTimeline.add(timeline, wait)
        this.timeline = timeline
        const touched: SVGGElement[] = []

        for (const { abbey } of placed)
            this.drop(this.nodeOf(this.houses, abbey, touched), timeline, quick)
        for (const { abbey } of lifted)
            this.liftOff(this.nodeOf(this.houses, abbey, touched), timeline)
        for (const change of changes) this.moveAdvisors(change, timeline, touched, quick)

        const land = () => {
            if (this.landMove === land) this.landMove = undefined
            if (this.timeline === timeline) this.timeline = undefined
            if (dropping) gsap.ticker.lagSmoothing(GSAP_STALL.threshold, GSAP_STALL.frame)
            this.tweened.clear()
            for (const node of touched) {
                setPose(node, { x: 0, y: 0, scale: 1 })
                gsap.set(node, { opacity: 1 })
            }
            // A switch of view mid-move has already shown another state, which must not be covered.
            if (this.session.gameState !== shown) return
            this.cloisters = to.cloisters
            this.advisors = to.advisors
            this.ringSizes = new Map()
        }
        this.landMove = land
        animationContext.afterAnimations(land)
    }

    private advisorChanges(from: HydratedWebOfPowerGameState, to: HydratedWebOfPowerGameState) {
        const countries = new Set([...from.advisors, ...to.advisors].map((a) => a.country))
        return [...countries]
            .map((country) => ({
                country,
                before: from.advisors.filter((advisor) => advisor.country === country).length,
                after: to.advisors.filter((advisor) => advisor.country === country).length
            }))
            .filter(({ before, after }) => before !== after)
    }

    private nodeOf(nodes: Map<string, SVGGElement>, key: string, touched: SVGGElement[]) {
        const node = nodes.get(key)
        if (node === undefined) throw Error(`Piece ${key} is drawn before it moves`)
        touched.push(node)
        this.tweened.add(node).add(poseOf(node))
        return node
    }

    private moveAdvisors(
        { country, before, after }: { country: Country; before: number; after: number },
        timeline: Timeline,
        touched: SVGGElement[],
        quick: boolean
    ) {
        const from = advisorSpots(country, before)
        const to = advisorSpots(country, after)
        const staying = Math.min(before, after)
        const slide = quick ? QUICK : SLIDE
        for (let index = 0; index < staying; index++) {
            const node = this.nodeOf(this.pegs, advisorKey(country, index), touched)
            const delta =
                after > before
                    ? { x: from[index].x - to[index].x, y: from[index].y - to[index].y }
                    : { x: to[index].x - from[index].x, y: to[index].y - from[index].y }
            if (delta.x === 0 && delta.y === 0) continue
            if (after > before) {
                timeline.fromTo(
                    poseOf(node),
                    { x: delta.x, y: delta.y },
                    { x: 0, y: 0, duration: slide, ease: 'power2.inOut', immediateRender: true },
                    0
                )
            } else {
                timeline.to(
                    poseOf(node),
                    { x: delta.x, y: delta.y, duration: slide, ease: 'power2.inOut' },
                    0
                )
            }
        }
        for (let index = staying; index < Math.max(before, after); index++) {
            const node = this.nodeOf(this.pegs, advisorKey(country, index), touched)
            if (after > before) this.drop(node, timeline, quick)
            else this.liftOff(node, timeline)
        }
    }

    private drop(node: SVGGElement, timeline: Timeline, quick: boolean) {
        const fall = quick ? QUICK : DROP.fall
        timeline.fromTo(
            node,
            { opacity: 0 },
            { opacity: 1, duration: fall * 0.25, ease: 'none', immediateRender: true },
            0
        )
        timeline.fromTo(
            poseOf(node),
            { y: DROP.rise },
            { y: 0, duration: fall, ease: 'power2.in', immediateRender: true },
            0
        )
        if (quick) return
        const half = DROP.settle / 2
        timeline.to(poseOf(node), { y: DROP.bounce, duration: half, ease: 'power1.out' }, fall)
        timeline.to(poseOf(node), { y: 0, duration: half, ease: 'power1.in' }, fall + half)
    }

    private liftOff(node: SVGGElement, timeline: Timeline) {
        timeline.to(poseOf(node), { y: LIFT_OFF.rise, duration: QUICK, ease: 'power1.out' }, 0)
        timeline.to(node, { opacity: 0, duration: QUICK, ease: 'power2.in' }, 0)
    }
}
