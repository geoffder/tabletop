import { tick } from 'svelte'
import type { Attachment } from 'svelte/attachments'
import { gsap } from 'gsap'
import type {
    AnimationContext,
    TransitionKind,
    TransitionStep
} from '@tabletop/frontend-components'
import {
    type Bridge,
    type Cell,
    cellAt,
    columnOf,
    type HydratedMexicaGameState,
    isDigCanal,
    isLand,
    isMovePilli,
    rowOf,
    type Temple
} from '@tabletop/mexica'
import type { MexicaGameSession, MoveInterrupter } from '$lib/model/session.svelte.js'
import { type Box, type BoardView, CELL } from '$lib/board/view.js'
import { pilliSpot } from '$lib/board/pilliSpot.js'
import { poseOf, setPose } from './svgPose.js'

// A page load, a sync with the server or a switch of view shows the board as it is, unmoved.
const ANIMATED_KINDS: ReadonlySet<TransitionKind> = new Set<TransitionKind>([
    'own-action',
    'other-action',
    'undo',
    'history',
    'exploration'
])

// A placed piece falls onto its square, gathering speed, and settles with a small bounce; its
// shadow waits on the square, small and faint, and darkens as the piece comes down.
const DROP = { fall: 0.26, rise: -40, scale: 1.06, bounce: [-4, -1.5], settle: 0.06, shadow: 0.55 }
// A piece taken off rises and fades.
const LIFT_OFF = { duration: 0.22, rise: -30, scale: 1.04 }
// A Pilli Mexica walks its route a square at a time, a small hop to each, and glides from or
// into a canal it crosses by boat.
const WALK = { hop: 0.15, glide: 0.2, height: -7 }
// A step without an action ends within QUICK: pieces slide straight to where they end, and
// placed pieces drop in or lift off.
const QUICK = 0.18
const MARK_FADE = 0.15
// A canal dug is built in from its sides: the paving gives way to brick from the edges to the
// middle, and then the water rises through the brick from below, like ground water.
const FLOOD = { build: 0.32, rise: 0.5 }
// The paving over a flooding square reaches this far into the land beside it, over the kerb the
// canal brings there.
const KERB_REACH = 3
// The motion waits at most this long for its pieces to be drawn; any longer skips its start.
const DRAW_WAIT = 0.01

export type DrawnPilli = { playerId: string; cell: Cell }
// What the board draws: the state shown, or while a step plays, everything on screen during it.
export type DrawnBoard = {
    canals: ReadonlySet<Cell>
    temples: readonly Temple[]
    bridges: readonly Bridge[]
    pillis: readonly DrawnPilli[]
}

// A square of paving laid over a canal square while the water floods it or the paving comes
// back, in plan units, with the side the water comes from.
// A canal tile being dug or filled in: its brick floor covers its squares, and its paving
// reaches over the kerbs beside them.
export type Flood = { key: string; cells: readonly Cell[]; box: Box; floor: Box }
type Side = 'n' | 'e' | 's' | 'w'

type Timeline = gsap.core.Timeline
type Step = TransitionStep<HydratedMexicaGameState, AnimationContext>
// A piece's drawing: its body, and its shadow on the board; a Pilli Mexica's group holding both,
// which moves it between squares; a bridge across the screen also has its near side, drawn over
// a Pilli Mexica on it.
type Parts = { whole?: SVGGElement; body?: SVGGElement; shadow?: SVGGElement; front?: SVGGElement }

export class BoardAnimator implements MoveInterrupter {
    drawn: DrawnBoard = $derived.by(() => this.boardOf(this.session.gameState))
    // Where each walking Pilli Mexica has got to, for the order the board draws in.
    walking: ReadonlyMap<string, Cell> = $state.raw(new Map())
    floods: readonly Flood[] = $state.raw([])

    private readonly parts = new Map<string, Parts>()
    private readonly marks = new Set<SVGElement>()
    private readonly floodEdges = new Map<string, SVGRectElement>()
    private readonly floodFloors = new Map<string, SVGPathElement>()
    private readonly listener = (step: Step) => this.onGameStateChange(step)
    private timeline: Timeline | undefined
    private landMove: (() => void) | undefined
    // The state of a presentation a switch of view left behind.
    private abandoned: HydratedMexicaGameState | undefined

    constructor(
        private readonly session: MexicaGameSession,
        private readonly view: () => BoardView
    ) {}

    readonly attach: Attachment = () => {
        this.session.addGameStateChangeListener(this.listener)
        this.session.moveInterrupters.add(this)
        return () => {
            this.session.removeGameStateChangeListener(this.listener)
            this.session.moveInterrupters.delete(this)
            this.stop()
        }
    }

    // A change of view lands the move at once: its motion was laid out in the old view.
    interrupt() {
        this.stop()
    }

    // A switch of view shows another state at once: the move stops where it is and the rest of
    // its replay is dropped.
    abandon() {
        if (this.stop()) this.abandoned = this.session.presentingState
    }

    // The node of one part of the piece drawn under `key`.
    piece(key: string, part: keyof Parts): Attachment<SVGGElement> {
        return (node) => {
            const own = this.parts.get(key) ?? {}
            own[part] = node
            this.parts.set(key, own)
            return () => {
                const current = this.parts.get(key)
                if (current?.[part] !== node) return
                delete current[part]
                if (Object.keys(current).length === 0) this.parts.delete(key)
            }
        }
    }

    // The clip of the paving over a flooding square, which the water wipes away.
    floodEdge(key: string): Attachment<SVGRectElement> {
        return (node) => {
            this.floodEdges.set(key, node)
            return () => {
                if (this.floodEdges.get(key) === node) this.floodEdges.delete(key)
            }
        }
    }

    // The brick floor of a square being built, which the water rises over.
    floodFloor(key: string): Attachment<SVGPathElement> {
        return (node) => {
            this.floodFloors.set(key, node)
            return () => {
                if (this.floodFloors.get(key) === node) this.floodFloors.delete(key)
            }
        }
    }

    // A choice mark, which fades as a move starts: its choices belong to the state it leaves.
    mark(): Attachment<SVGElement> {
        return (node) => {
            this.marks.add(node)
            return () => {
                this.marks.delete(node)
            }
        }
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
            this.drawn = this.boardOf(this.session.gameState)
            this.walking = new Map()
            this.floods = []
            throw error
        }
    }

    private async present({ kind, to, from, action, animationContext }: Step) {
        if (from === undefined || !ANIMATED_KINDS.has(kind)) return
        const presenting = this.session.presentingState
        if (presenting !== undefined && presenting === this.abandoned) return
        this.abandoned = undefined

        const before = this.boardOf(from)
        const after = this.boardOf(to)
        const dug = [...after.canals].filter((cell) => !before.canals.has(cell))
        const filled = [...before.canals].filter((cell) => !after.canals.has(cell))
        const temples = this.changed(before.temples, after.temples, (temple) => temple.cell)
        const bridges = this.changed(before.bridges, after.bridges, (bridge) => bridge.cell)
        const moves = after.pillis.flatMap((pilli) => {
            const was = before.pillis.find((other) => other.playerId === pilli.playerId)
            return was === undefined || was.cell !== pilli.cell
                ? [{ playerId: pilli.playerId, from: was?.cell, to: pilli.cell }]
                : []
        })
        const gone = before.pillis.filter(
            (pilli) => !after.pillis.some((other) => other.playerId === pilli.playerId)
        )
        if (
            dug.length + filled.length === 0 &&
            temples.added.length + temples.removed.length === 0 &&
            bridges.added.length + bridges.removed.length === 0 &&
            moves.length + gone.length === 0
        ) {
            return
        }

        const shown = this.session.gameState
        const quick = action === undefined
        const touched: SVGGElement[] = []
        // Pieces taken off stay on screen until they have gone; pieces put down are drawn from
        // the start, hidden until they drop.
        this.drawn = {
            canals: new Set([...before.canals, ...after.canals]),
            temples: [...before.temples, ...temples.added],
            bridges: [...before.bridges, ...bridges.added],
            pillis: [
                ...before.pillis.filter((pilli) =>
                    after.pillis.some((other) => other.playerId === pilli.playerId)
                ),
                ...gone,
                ...moves.flatMap((move) =>
                    move.from === undefined ? [{ playerId: move.playerId, cell: move.to }] : []
                )
            ]
        }
        const tilesOf = (state: HydratedMexicaGameState, changed: readonly Cell[]) =>
            state.canals.filter((tile) => tile.cells.some((cell) => changed.includes(cell)))
        this.floods = [
            ...tilesOf(to, dug).map((tile) => this.floodOf(tile.cells, before.canals)),
            ...tilesOf(from, filled).map((tile) => this.floodOf(tile.cells, after.canals))
        ]
        const drawing = performance.now()
        await tick()
        const timeline = gsap.timeline()
        this.timeline = timeline
        const waited = (performance.now() - drawing) / 1000
        animationContext.actionTimeline.add(timeline, Math.min(waited, DRAW_WAIT))

        const marks = [...this.marks]
        if (marks.length > 0) {
            timeline.to(marks, { opacity: 0, duration: quick ? QUICK : MARK_FADE, ease: 'none' }, 0)
        }
        const fall = quick ? QUICK : DROP.fall
        const lift = quick ? QUICK : LIFT_OFF.duration
        const digging = !quick && isDigCanal(action)
        for (const flood of this.floods) {
            this.flood(flood, dug.includes(flood.cells[0]), timeline, digging)
        }
        // A bridge moved comes off its canal before it goes down on the next.
        const dropAt = !quick && bridges.removed.length > 0 ? LIFT_OFF.duration * 0.7 : 0
        for (const temple of temples.removed) {
            this.liftOff(`temple-${temple.cell}`, timeline, touched, lift)
        }
        for (const bridge of bridges.removed) {
            this.liftOff(`bridge-${bridge.cell}`, timeline, touched, lift)
        }
        for (const temple of temples.added) {
            this.drop(`temple-${temple.cell}`, timeline, touched, fall, !quick, 0)
        }
        for (const bridge of bridges.added) {
            this.drop(`bridge-${bridge.cell}`, timeline, touched, fall, !quick, dropAt)
        }
        for (const pilli of gone) {
            this.liftOff(`pilli-${pilli.playerId}`, timeline, touched, lift)
        }
        const view = this.view()
        const decks = new Set([...before.bridges, ...after.bridges].map((bridge) => bridge.cell))
        for (const move of moves) {
            const key = `pilli-${move.playerId}`
            if (move.from === undefined) {
                this.drop(key, timeline, touched, fall, !quick, 0)
                continue
            }
            const walked =
                !quick && isMovePilli(action) && action.playerId === move.playerId
                    ? action.metadata
                    : undefined
            if (walked?.teleport) {
                this.teleport(key, move.from, move.to, decks, timeline, touched)
            } else if (walked !== undefined) {
                this.walk(key, move.playerId, walked.path, decks, timeline, touched)
            } else {
                const start = pilliSpot(view, move.from, new Set(before.bridges.map((b) => b.cell)))
                const end = pilliSpot(view, move.to, new Set(after.bridges.map((b) => b.cell)))
                const { whole } = this.partsOf(key, touched)
                timeline.to(
                    poseOf(whole),
                    {
                        x: end.x - start.x,
                        y: end.y - start.y,
                        duration: QUICK,
                        ease: 'power1.inOut'
                    },
                    0
                )
            }
        }

        const land = () => {
            if (this.landMove === land) this.landMove = undefined
            if (this.timeline === timeline) this.timeline = undefined
            this.walking = new Map()
            this.floods = []
            for (const node of touched) {
                setPose(node, { x: 0, y: 0, scale: 1 })
                gsap.set(node, { opacity: 1 })
            }
            for (const node of marks) gsap.set(node, { clearProps: 'opacity' })
            // A switch of view while the move played has already shown another state, which
            // this move's board must not cover.
            if (this.session.gameState !== shown) return
            this.drawn = after
        }
        this.landMove = land
        animationContext.afterAnimations(land)
    }

    // The paving draws in from every side to the tile's middle, leaving brick, and then the
    // water wells up through the middle of the floor and spreads out to the banks. Filled in
    // again, the brick closes over the water and the paving spreads back over the brick.
    private flood(flood: Flood, dug: boolean, timeline: Timeline, digging: boolean) {
        const edge = this.floodEdges.get(flood.key)
        const floor = this.floodFloors.get(flood.key)
        if (edge === undefined || floor === undefined) {
            throw new Error('A flooding canal is drawn before it floods')
        }
        const { x, y, width, height } = flood.box
        const whole = { x, y, width, height }
        const gone = { x: x + width / 2, y: y + height / 2, width: 0, height: 0 }
        const build = digging ? FLOOD.build : QUICK / 2
        const rise = digging ? FLOOD.rise : QUICK / 2
        const water = this.welling(floor, flood.floor)
        const immediateRender = true
        if (dug) {
            timeline.fromTo(
                edge,
                { attr: whole },
                { attr: gone, duration: build, ease: 'power1.in', immediateRender },
                0
            )
            timeline.fromTo(
                water,
                { reach: 0 },
                { reach: 1, duration: rise, ease: 'power1.out', immediateRender },
                build
            )
            return
        }
        timeline.fromTo(
            water,
            { reach: 1 },
            { reach: 0, duration: rise, ease: 'power1.in', immediateRender },
            0
        )
        timeline.fromTo(
            edge,
            { attr: gone },
            { attr: whole, duration: build, ease: 'power1.out', immediateRender },
            rise
        )
    }

    // The water in a canal's brick floor as it wells up: a pool from the floor's middle whose
    // `reach` grows from nothing to the whole floor, cut out of the floor's path as it is set.
    private welling(node: SVGPathElement, floor: Box): { reach: number } {
        const { x, y, width, height } = floor
        const outline = `M${x} ${y}H${x + width}V${y + height}H${x}Z`
        const cx = x + width / 2
        const cy = y + height / 2
        let reach = 0
        const write = () => {
            if (reach <= 0) {
                node.setAttribute('d', outline)
                return
            }
            const hx = (width / 2 + 2) * reach
            const hy = (height / 2 + 2) * reach
            const r = Math.min(hx, hy)
            const pool =
                `M${cx - hx + r} ${cy - hy}H${cx + hx - r}A${r} ${r} 0 0 1 ${cx + hx} ${cy - hy + r}` +
                `V${cy + hy - r}A${r} ${r} 0 0 1 ${cx + hx - r} ${cy + hy}H${cx - hx + r}` +
                `A${r} ${r} 0 0 1 ${cx - hx} ${cy + hy - r}V${cy - hy + r}A${r} ${r} 0 0 1 ${cx - hx + r} ${cy - hy}Z`
            node.setAttribute('d', outline + pool)
        }
        write()
        return {
            get reach() {
                return reach
            },
            set reach(value: number) {
                reach = value
                write()
            }
        }
    }

    // A canal tile, and the reach of its paving over the kerb on each side where land stays
    // beside it.
    private floodOf(cells: readonly Cell[], water: ReadonlySet<Cell>): Flood {
        const steps: [Side, number, number][] = [
            ['w', -1, 0],
            ['e', 1, 0],
            ['n', 0, -1],
            ['s', 0, 1]
        ]
        const columns = cells.map(columnOf)
        const rows = cells.map(rowOf)
        const left = Math.min(...columns)
        const top = Math.min(...rows)
        const right = Math.max(...columns) + 1
        const bottom = Math.max(...rows) + 1
        // Kerbs reach over a side where any square beside the tile on it is land.
        const reach = (side: Side) => {
            const [, dc, dr] = steps.find(([named]) => named === side) ?? steps[0]
            const land = cells.some((cell) => {
                const other = cellAt(columnOf(cell) + dc, rowOf(cell) + dr)
                return (
                    other !== undefined &&
                    !cells.includes(other) &&
                    isLand(other) &&
                    !water.has(other)
                )
            })
            return land ? KERB_REACH : 0
        }
        const floor = {
            x: left * CELL,
            y: top * CELL,
            width: (right - left) * CELL,
            height: (bottom - top) * CELL
        }
        return {
            key: cells.join('-'),
            cells,
            floor,
            box: {
                x: floor.x - reach('w'),
                y: floor.y - reach('n'),
                width: floor.width + reach('w') + reach('e'),
                height: floor.height + reach('n') + reach('s')
            }
        }
    }

    // The Pilli Mexica walks its route: a small hop onto each square, a glide onto or off the
    // water of a canal it crosses by boat. Its group moves between squares and its body hops.
    private walk(
        key: string,
        playerId: string,
        path: readonly Cell[],
        decks: ReadonlySet<Cell>,
        timeline: Timeline,
        touched: SVGGElement[]
    ) {
        const view = this.view()
        const { body, whole } = this.partsOf(key, touched)
        const water = this.session.gameState.layout().canals
        const start = pilliSpot(view, path[0], decks)
        const wholePose = poseOf(whole)
        const bodyPose = poseOf(body)
        let at = 0
        for (let index = 1; index < path.length; index++) {
            const cell = path[index]
            const end = pilliSpot(view, cell, decks)
            const afloat =
                (water.has(cell) && !decks.has(cell)) ||
                (water.has(path[index - 1]) && !decks.has(path[index - 1]))
            const duration = afloat ? WALK.glide : WALK.hop
            timeline.to(
                wholePose,
                {
                    x: end.x - start.x,
                    y: end.y - start.y,
                    duration,
                    ease: afloat ? 'sine.inOut' : 'none'
                },
                at
            )
            if (!afloat) {
                timeline.to(
                    bodyPose,
                    { y: WALK.height, duration: duration / 2, ease: 'power1.out' },
                    at
                )
                timeline.to(
                    bodyPose,
                    { y: 0, duration: duration / 2, ease: 'power1.in' },
                    at + duration / 2
                )
            }
            // Drawn in the order of the square it is crossing into, once it is halfway there.
            timeline.call(
                () => {
                    this.walking = new Map([...this.walking, [playerId, cell]])
                },
                undefined,
                at + duration / 2
            )
            at += duration
        }
    }

    // Five action points take the Pilli Mexica anywhere: it lifts off and drops in there.
    private teleport(
        key: string,
        from: Cell,
        to: Cell,
        decks: ReadonlySet<Cell>,
        timeline: Timeline,
        touched: SVGGElement[]
    ) {
        const view = this.view()
        const { whole } = this.partsOf(key, touched)
        this.liftOff(key, timeline, touched, LIFT_OFF.duration)
        const start = pilliSpot(view, from, decks)
        const end = pilliSpot(view, to, decks)
        timeline.set(poseOf(whole), { x: end.x - start.x, y: end.y - start.y }, LIFT_OFF.duration)
        this.drop(key, timeline, touched, DROP.fall, true, LIFT_OFF.duration, false)
    }

    private drop(
        key: string,
        timeline: Timeline,
        touched: SVGGElement[],
        fall: number,
        bounce: boolean,
        at: number,
        hideFromStart = true
    ) {
        const { body, shadow, front } = this.partsOf(key, touched)
        const immediateRender = hideFromStart
        for (const node of [body, front]) {
            if (node === undefined) continue
            timeline.fromTo(
                poseOf(node),
                { scale: DROP.scale, y: DROP.rise },
                { scale: 1, y: 0, duration: fall, ease: 'power1.in', immediateRender },
                at
            )
            timeline.fromTo(
                node,
                { opacity: 0 },
                { opacity: 1, duration: fall * 0.25, ease: 'none', immediateRender },
                at
            )
            if (!bounce) continue
            DROP.bounce.forEach((height, index) => {
                const up = at + fall + index * DROP.settle * 2
                timeline.to(
                    poseOf(node),
                    { y: height, duration: DROP.settle, ease: 'power1.out' },
                    up
                )
                timeline.to(
                    poseOf(node),
                    { y: 0, duration: DROP.settle, ease: 'power1.in' },
                    up + DROP.settle
                )
            })
        }
        if (shadow === undefined) return
        timeline.fromTo(
            poseOf(shadow),
            { scale: DROP.shadow },
            { scale: 1, duration: fall, ease: 'power1.in', immediateRender },
            at
        )
        timeline.fromTo(
            shadow,
            { opacity: 0 },
            { opacity: 1, duration: fall, ease: 'power1.in', immediateRender },
            at
        )
    }

    private liftOff(key: string, timeline: Timeline, touched: SVGGElement[], duration: number) {
        const { body, shadow, front } = this.partsOf(key, touched)
        const { rise, scale } = LIFT_OFF
        for (const node of [body, front]) {
            if (node === undefined) continue
            timeline.to(poseOf(node), { y: rise, scale, duration, ease: 'power1.out' }, 0)
            timeline.to(node, { opacity: 0, duration, ease: 'power2.in' }, 0)
        }
        if (shadow === undefined) return
        timeline.to(poseOf(shadow), { scale: DROP.shadow, duration, ease: 'power1.out' }, 0)
        timeline.to(shadow, { opacity: 0, duration, ease: 'power1.out' }, 0)
    }

    private partsOf(
        key: string,
        touched: SVGGElement[]
    ): Parts & { body: SVGGElement; whole: SVGGElement } {
        const parts = this.parts.get(key)
        const body = parts?.body
        if (parts === undefined || body === undefined) {
            throw new Error(`The piece ${key} is drawn before it moves`)
        }
        for (const node of [parts.whole, body, parts.shadow, parts.front]) {
            if (node !== undefined) touched.push(node)
        }
        return { ...parts, body, whole: parts.whole ?? body }
    }

    private changed<T>(before: readonly T[], after: readonly T[], key: (item: T) => Cell) {
        const had = new Set(before.map(key))
        const has = new Set(after.map(key))
        return {
            added: after.filter((item) => !had.has(key(item))),
            removed: before.filter((item) => !has.has(key(item)))
        }
    }

    private boardOf(state: HydratedMexicaGameState): DrawnBoard {
        return {
            canals: state.layout().canals,
            temples: state.temples,
            bridges: state.bridges,
            pillis: state.players.flatMap((player) =>
                player.pilli === undefined
                    ? []
                    : [{ playerId: player.playerId, cell: player.pilli }]
            )
        }
    }
}
