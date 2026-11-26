import { tick } from 'svelte'
import type { Attachment } from 'svelte/attachments'
import { prefersReducedMotion } from 'svelte/motion'
import { gsap } from 'gsap'
import type {
    AnimationContext,
    TransitionKind,
    TransitionStep
} from '@tabletop/frontend-components'
import type { HydratedHomeworldsGameState } from '@tabletop/homeworlds'
import type { HomeworldsGameSession, MoveInterrupter } from '$lib/model/session.svelte.js'
import { tableLayout, type TableLayout } from '$lib/board/layout.js'
import { drawnPieces, type DrawnPiece, samePose } from '$lib/board/pieces.js'
import { onTable, type BoardView } from '$lib/board/view.js'
import { setPose } from './svgPose.js'

// A page load, a sync with the server or a switch of view shows the table as it is, unmoved.
const ANIMATED_KINDS: ReadonlySet<TransitionKind> = new Set<TransitionKind>([
    'own-action',
    'other-action',
    'undo',
    'history',
    'exploration'
])

// A piece that changes place flies over the table on an arc as high as a share of the distance;
// one that only shifts with the map glides. A step without an action ends within QUICK.
const FLIGHT = { least: 0.36, most: 0.6, perUnit: 1 / 1600, arc: 0.3, highest: 120, lowest: 26 }
const GLIDE = 0.34
const TOKEN_SLIDE = 0.5
const TOKEN_LIFT = 46
const QUICK = 0.18
const QUICK_ARC = 12
// The motion waits for the board to draw what it moves, but never longer than this.
const DRAW_WAIT = 0.01

type Timeline = gsap.core.Timeline
type Step = TransitionStep<HydratedHomeworldsGameState, AnimationContext>
type Parts = { body?: SVGGElement; shadow?: SVGElement }
export type TokenSide = 'near' | 'far'

export class BoardAnimator implements MoveInterrupter {
    // What the board draws. A move first draws every piece where it stood, then flies it to
    // where it lands; the state's own drawing takes over once the state is shown.
    layout: TableLayout = $derived.by(() => this.session.layout)
    pieces: ReadonlyMap<number, DrawnPiece> = $derived.by(() =>
        drawnPieces(this.session.layout, this.session.shownBank)
    )
    // Pieces in the air, drawn over everything they cross.
    flying: ReadonlySet<number> = $derived.by(() => {
        void this.session.gameState
        return new Set<number>()
    })
    tokenSide: TokenSide = $derived.by(() => this.sideOf(this.session.gameState))
    // While carried to the other side, the token is drawn over the pieces.
    tokenFlying: boolean = $derived.by(() => {
        void this.session.gameState
        return false
    })
    tokenFacing: TokenSide = $derived.by(() => this.sideOf(this.session.gameState))

    private readonly parts = new Map<number, Parts>()
    private token: SVGGElement | undefined
    private readonly listener = (step: Step) => this.onGameStateChange(step)
    private landMove: (() => void) | undefined
    private timeline: Timeline | undefined
    // The state of a presentation a switch of view left behind.
    private abandoned: HydratedHomeworldsGameState | undefined

    constructor(private readonly session: HomeworldsGameSession) {}

    readonly attach: Attachment = () => {
        this.session.addGameStateChangeListener(this.listener)
        this.session.moveInterrupter = this
        return () => {
            this.session.removeGameStateChangeListener(this.listener)
            if (this.session.moveInterrupter === this) this.session.moveInterrupter = undefined
            this.stop()
        }
    }

    interrupt() {
        this.stop()
    }

    abandon() {
        if (this.stop()) this.abandoned = this.session.presentingState
    }

    part(piece: number, kind: keyof Parts): Attachment<SVGGElement | SVGElement> {
        return (node) => {
            const own = this.parts.get(piece) ?? {}
            if (kind === 'body' && node instanceof SVGGElement) own.body = node
            if (kind === 'shadow') own.shadow = node
            this.parts.set(piece, own)
            return () => {
                const current = this.parts.get(piece)
                if (current?.[kind] !== node) return
                delete current[kind]
                if (current.body === undefined && current.shadow === undefined) {
                    this.parts.delete(piece)
                }
            }
        }
    }

    readonly tokenNode: Attachment<SVGGElement> = (node) => {
        this.token = node
        return () => {
            if (this.token === node) this.token = undefined
        }
    }

    private sideOf(state: HydratedHomeworldsGameState): TokenSide {
        const active = state.activePlayerIds[0] ?? state.turnManager.currentTurn()?.playerId
        return active === undefined || active === this.session.nearId ? 'near' : 'far'
    }

    private stop(): boolean {
        const land = this.landMove
        if (land === undefined) return false
        this.timeline?.kill()
        land()
        return true
    }

    private async onGameStateChange(step: Step) {
        try {
            await this.present(step)
        } catch (error) {
            this.landMove?.()
            throw error
        }
    }

    private async present({ kind, to, from, action, animationContext }: Step) {
        // A player who asks for reduced motion sees each state at rest, as on a page load.
        if (from === undefined || !ANIMATED_KINDS.has(kind) || prefersReducedMotion.current) return
        const presenting = this.session.presentingState
        if (presenting !== undefined && presenting === this.abandoned) return
        this.abandoned = undefined
        const quick = action === undefined
        const view = this.session.view
        const seats = { nearId: this.session.nearId, farId: this.session.farId }

        const wide = this.session.wideMap
        const toLayout = tableLayout(to.starMap.systems, seats, view, wide)
        // Your own move starts from the table as you saw it, with any homeworld you were building.
        const before =
            kind === 'own-action'
                ? this.pieces
                : drawnPieces(
                      tableLayout(from.starMap.systems, seats, view, wide),
                      from.starMap.bank()
                  )
        const after = drawnPieces(toLayout, to.starMap.bank())
        const fromSide = this.sideOf(from)
        const toSide = this.sideOf(to)

        const moves = [...after.values()].flatMap((landing) => {
            const start = before.get(landing.piece)
            return start && !this.resting(start, landing) ? [{ start, landing }] : []
        })
        const relocated = moves.filter(({ start, landing }) => this.relocates(start, landing))

        this.layout = toLayout
        this.pieces = before
        this.flying = new Set(relocated.map(({ landing }) => landing.piece))
        this.tokenSide = fromSide
        this.tokenFacing = fromSide
        this.tokenFlying = fromSide !== toSide
        const drawing = performance.now()
        await tick()

        // The context's timelines run from the moment it is made, just before this listener.
        const timeline = gsap.timeline()
        const wait = Math.min(DRAW_WAIT, (performance.now() - drawing) / 1000)
        animationContext.actionTimeline.add(timeline, wait)
        this.timeline = timeline
        const touched: SVGElement[] = []

        const land = () => {
            this.landMove = undefined
            this.timeline = undefined
            for (const node of touched) setPose(node, { x: 0, y: 0, scale: 1 })
            this.pieces = after
            this.flying = new Set()
            this.tokenSide = toSide
            this.tokenFacing = toSide
            this.tokenFlying = false
        }
        this.landMove = land

        for (const { start, landing } of moves) {
            const parts = this.parts.get(landing.piece)
            if (parts?.body === undefined) throw Error('A piece is drawn before it moves')
            touched.push(parts.body)
            if (parts.shadow) touched.push(parts.shadow)
            this.fly(timeline, view, parts, start, landing, quick)
        }

        if (fromSide !== toSide && this.token) {
            const token = this.token
            touched.push(token)
            const a = onTable(
                view,
                toLayout.tokenSpots[fromSide].x,
                toLayout.tokenSpots[fromSide].y
            )
            const b = onTable(view, toLayout.tokenSpots[toSide].x, toLayout.tokenSpots[toSide].y)
            const slide = quick ? QUICK : TOKEN_SLIDE
            const lift = quick ? QUICK_ARC : TOKEN_LIFT
            const motion = this.motion((u) =>
                setPose(token, { x: (b.x - a.x) * u, y: (b.y - a.y) * u - lift * 4 * u * (1 - u) })
            )
            timeline.to(motion, { u: 1, duration: slide, ease: 'power2.inOut' }, 0)
            timeline.call(() => (this.tokenFacing = toSide), undefined, slide / 2)
        }

        animationContext.afterAnimations(() => {
            if (this.landMove === land) land()
        })
    }

    // Whether a piece already stands where it lands, as it is drawn there.
    private resting(start: DrawnPiece, landing: DrawnPiece): boolean {
        return start.x === landing.x && start.y === landing.y && samePose(start.pose, landing.pose)
    }

    // A piece that changes system, role or owner, or turns, takes off; one that only shifts with
    // the map or settles in its tower glides.
    private relocates(start: DrawnPiece, landing: DrawnPiece): boolean {
        if (start.role !== landing.role || start.systemId !== landing.systemId) return true
        if (start.ownerId !== landing.ownerId) return true
        return start.pose.kind === 'ship' && !samePose(start.pose, landing.pose)
    }

    private fly(
        timeline: Timeline,
        view: BoardView,
        parts: Parts,
        start: DrawnPiece,
        landing: DrawnPiece,
        quick: boolean
    ) {
        const a = onTable(view, start.x, start.y)
        const b = onTable(view, landing.x, landing.y)
        const dx = b.x - a.x
        const dy = b.y - a.y
        const { body, shadow } = parts
        if (body === undefined) return
        if (!this.relocates(start, landing)) {
            // Shifting with the map, or a tower or binary star settling: the pose changes at once
            // and the piece glides from where it stood, its height kept on screen.
            const liftFrom = start.pose.kind === 'star' ? start.pose.lift : 0
            const liftTo = landing.pose.kind === 'star' ? landing.pose.lift : 0
            const rise = (liftTo - liftFrom) * view.rise
            this.swapPose(start, landing)
            const motion = this.motion((u) => {
                setPose(body, { x: dx * u, y: dy * u + rise * (1 - u) })
                if (shadow) setPose(shadow, { x: dx * u, y: dy * u })
            })
            motion.u = 0
            timeline.to(motion, { u: 1, duration: quick ? QUICK : GLIDE, ease: 'power2.inOut' }, 0)
            return
        }
        const distance = Math.hypot(dx, dy)
        const duration = quick
            ? QUICK
            : Math.min(
                  FLIGHT.most,
                  Math.max(FLIGHT.least, FLIGHT.least + distance * FLIGHT.perUnit)
              )
        const arc = quick
            ? QUICK_ARC
            : Math.min(FLIGHT.highest, Math.max(FLIGHT.lowest, distance * FLIGHT.arc))
        const motion = this.motion((u) => {
            setPose(body, { x: dx * u, y: dy * u - arc * 4 * u * (1 - u) })
            if (shadow) setPose(shadow, { x: dx * u, y: dy * u })
        })
        timeline.to(motion, { u: 1, duration, ease: 'power1.inOut' }, 0)
        // It turns into its new pose at the top of its arc: a ship stands up as a star, a star lies
        // down as a ship, a captured ship turns round.
        if (!samePose(start.pose, landing.pose)) {
            timeline.call(() => this.swapPose(start, landing), undefined, duration / 2)
        }
    }

    // The piece keeps its place while taking its new pose.
    private swapPose(start: DrawnPiece, landing: DrawnPiece) {
        const pieces = new Map(this.pieces)
        pieces.set(start.piece, { ...landing, x: start.x, y: start.y })
        this.pieces = pieces
    }

    // A progress the timeline tweens; its setter writes the pose, so a seek leaves it right.
    private motion(write: (u: number) => void): { u: number } {
        let at = 0
        return {
            get u() {
                return at
            },
            set u(u: number) {
                at = u
                write(u)
            }
        }
    }
}
