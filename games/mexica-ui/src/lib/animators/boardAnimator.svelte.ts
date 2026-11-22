import { tick } from 'svelte'
import type { Attachment } from 'svelte/attachments'
import { gsap } from 'gsap'
import type {
    AnimationContext,
    TransitionKind,
    TransitionStep
} from '@tabletop/frontend-components'
import {
    areAdjacent,
    type Bridge,
    type District,
    type Cell,
    cellAt,
    CELL_COUNT,
    columnOf,
    type HydratedMexicaGameState,
    isDigCanal,
    DIRECTIONS,
    Direction,
    isLake,
    isLand,
    isMovePilli,
    neighbour,
    neighbours,
    rowOf,
    type Temple,
    tokenSize
} from '@tabletop/mexica'
import type { MexicaGameSession, MoveInterrupter } from '$lib/model/session.svelte.js'
import type { Point } from '@tabletop/common'
import { type Box, type BoardView, BRIDGE_RISE, CELL } from '$lib/board/view.js'
import { pilliSpot } from '$lib/board/pilliSpot.js'
import { TOKEN_ON_BOARD, TOKEN_ON_DISPLAY } from '$lib/board/tokenShape.js'
import { COVE_TOE } from '$lib/board/looks.js'
import { BANK_WIDTH } from '$lib/board/waterworks.js'
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
// A ride by boat from bridge to bridge: a canoe slides out from under the first bridge in
// `emerge`, the Pilli Mexica hops down into it and is paddled along the canals and the lake,
// `cell` seconds a square, at least `least`; at a bridge on the way the canoe passes under while
// the Pilli hops over the deck, `over` above it, and lands in the canoe again; at the last
// bridge the Pilli hops up onto the deck and the canoe slides back under. Longer than a bridge
// is wide, it fades as it goes under. The canoe waits `off` of a square short of each end
// bridge's middle, and the Pilli rides `sink` lower than it stands on the ground.
const BOAT = {
    cell: 0.17,
    least: 0.45,
    hop: 0.24,
    show: 0.16,
    off: 0.62,
    over: 7,
    sink: 3,
    emerge: 0.3
}
// The display closing up behind a token that leaves, once it has lifted off.
const CLOSE_UP = { at: 0.2, duration: 0.35 }
// How much bigger the display shows a token than the board does.
const DISPLAY_SCALE = TOKEN_ON_DISPLAY / TOKEN_ON_BOARD
// A step without an action ends within QUICK: pieces slide straight to where they end, and
// placed pieces drop in or lift off.
const QUICK = 0.18
const MARK_FADE = 0.15
// A canal dug: the paving runs away like a liquid to show its finished banks over the earth, and
// then water runs in the same way from the canal or lake beside it, or with none, from the middle.
const DIG = { build: 0.3, water: 0.32 }
// The same without an action (Undo, history), quicker: undone, the water drains back the way it
// came, and then the paving runs back over the banks.
const DIG_QUICK = { build: 0.2, water: 0.2 }
// The paving over a flooding square reaches this far into the land beside it, over the kerb the
// canal brings there.
const KERB_REACH = 3
// The motion waits at most this long for its pieces to be drawn; any longer skips its start.
const DRAW_WAIT = 0.01

export type DrawnPilli = { playerId: string; cell: Cell }
// What the board draws: the state shown, or while a step plays, everything on screen during it.
export type DrawnBoard = {
    districts: readonly District[]
    display: readonly number[]
    canals: ReadonlySet<Cell>
    temples: readonly Temple[]
    bridges: readonly Bridge[]
    pillis: readonly DrawnPilli[]
}

// A canal tile being dug or filled in, in plan units: its paving reaches over the kerbs beside
// its squares (`box`).
export type Flood = {
    key: string
    cells: readonly Cell[]
    box: Box
    // The walls' foot, rounded where two walls meet in a cove: the earth at the canal's bottom.
    footPath: string
    // Where the water runs in from: the middle of each edge it meets water by, or with none, the
    // middle of the floor; and how far a disc from each must reach to fill the foot.
    // `cover` is how far a disc must reach to clear the paving over the whole canal and kerbs.
    springs: readonly { x: number; y: number; reach: number; cover: number }[]
}
type Side = 'n' | 'e' | 's' | 'w'
// The discs that run in from a spring: clearing the paving (build), then the water over the
// canal's floor (water) and up its banks (wet), which reaches past the floor by WET_REACH.
type SpringKind = 'water' | 'wet' | 'build'
const WET_REACH = 6

type Timeline = gsap.core.Timeline
type Step = TransitionStep<HydratedMexicaGameState, AnimationContext>
// A piece's drawing: its body, and its shadow on the board; a Pilli Mexica's group holding both,
// which moves it between squares; a bridge across the screen also has its near side, drawn over
// a Pilli Mexica on it.
type Parts = { whole?: SVGGElement; body?: SVGGElement; shadow?: SVGGElement; front?: SVGGElement }

// A rectangle with its corners rounded by `radii`, clockwise from the top left.
function roundedRect(x0: number, y0: number, x1: number, y1: number, radii: number[]): string {
    const [a, b, c, d] = radii.map((r) => Math.max(0, Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2)))
    return (
        `M${x0 + a} ${y0}H${x1 - b}A${b} ${b} 0 0 1 ${x1} ${y0 + b}` +
        `V${y1 - c}A${c} ${c} 0 0 1 ${x1 - c} ${y1}H${x0 + d}` +
        `A${d} ${d} 0 0 1 ${x0} ${y1 - d}V${y0 + a}A${a} ${a} 0 0 1 ${x0 + a} ${y0}Z`
    )
}

// A disc of water running in, its radius written as it is set.
class Disc {
    private radius = 0

    constructor(private readonly node: SVGElement) {}

    get r() {
        return this.radius
    }

    set r(r: number) {
        this.radius = r
        this.node.setAttribute('r', `${r}`)
    }
}

export class BoardAnimator implements MoveInterrupter {
    drawn: DrawnBoard = $derived.by(() => this.boardOf(this.session.gameState))
    // Where each walking Pilli Mexica has got to, for the order the board draws in.
    walking: ReadonlyMap<string, Cell> = $state.raw(new Map())
    floods: readonly Flood[] = $state.raw([])
    // The canoes Pilli Mexica are riding in this move.
    boats: readonly string[] = $state.raw([])
    // Calpulli tokens going between the Emperor's display and the board, drawn over everything.
    flights: readonly District[] = $state.raw([])

    private readonly parts = new Map<string, Parts>()
    private readonly marks = new Set<SVGElement>()
    private readonly springNodes = new Map<string, SVGCircleElement>()
    private readonly floodPavings = new Map<string, SVGImageElement>()
    private readonly boatNodes = new Map<string, SVGGElement>()
    private readonly listener = (step: Step) => this.onGameStateChange(step)
    private timeline: Timeline | undefined
    private landMove: (() => void) | undefined
    // The state of a presentation a switch of view left behind.
    private abandoned: HydratedMexicaGameState | undefined

    constructor(
        private readonly session: MexicaGameSession,
        private readonly view: () => BoardView,
        // Where the Emperor's display shows the token at an index.
        private readonly slot: (index: number) => Point
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

    // The paving over a canal being dug.
    floodPaving(key: string): Attachment<SVGImageElement> {
        return (node) => {
            this.floodPavings.set(key, node)
            return () => {
                if (this.floodPavings.get(key) === node) this.floodPavings.delete(key)
            }
        }
    }

    // A canoe, its hull drawn round the origin along x in board units; the animator places it
    // and turns it on the board.
    boat(key: string): Attachment<SVGGElement> {
        return (node) => {
            this.boatNodes.set(key, node)
            return () => {
                if (this.boatNodes.get(key) === node) this.boatNodes.delete(key)
            }
        }
    }

    // A disc of water running into a dug canal from one of its springs.
    spring(key: string, kind: SpringKind, index: number): Attachment<SVGCircleElement> {
        const name = `${key}-${kind}-${index}`
        return (node) => {
            this.springNodes.set(name, node)
            return () => {
                if (this.springNodes.get(name) === node) this.springNodes.delete(name)
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
            this.boats = []
            this.flights = []
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
        const founded = after.districts.filter(
            (district) => !before.districts.some((other) => other.tokenId === district.tokenId)
        )
        const unfounded = before.districts.filter(
            (district) => !after.districts.some((other) => other.tokenId === district.tokenId)
        )
        if (
            founded.length + unfounded.length === 0 &&
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
        // A token on its way is drawn as a flight over everything; the display keeps its slot
        // until the move ends.
        // Dropped onto its square, a founded token is in the board's layer from the start; one
        // sliding between the display and the board goes over everything.
        const flying = [...(quick ? founded : []), ...unfounded]
        this.flights = flying
        this.drawn = {
            districts: after.districts.filter((district) => !flying.includes(district)),
            display: before.display.length >= after.display.length ? before.display : after.display,
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
        this.boats = quick
            ? []
            : moves.flatMap((move) => {
                  const walked =
                      isMovePilli(action) &&
                      action.playerId === move.playerId &&
                      !action.metadata?.teleport
                          ? action.metadata?.path
                          : undefined
                  return walked !== undefined &&
                      voyagesOf(walked, decksOf(before, after)).length > 0
                      ? [`boat-${move.playerId}`]
                      : []
              })
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
        for (const district of founded) {
            this.found(district, before.display.indexOf(district.tokenId), timeline, touched, quick)
        }
        for (const district of unfounded) {
            this.unfound(district, after.display.indexOf(district.tokenId), timeline, touched)
        }
        // The tokens left on the display close up behind one that leaves, and open up for one
        // put back.
        if (founded.length + unfounded.length > 0) {
            const drawnDisplay = this.drawn.display
            const ends = after.display
            drawnDisplay.forEach((tokenId, index) => {
                if (flying.some((district) => district.tokenId === tokenId)) return
                const goes = ends.indexOf(tokenId)
                const was = before.display.indexOf(tokenId)
                if (goes === was) return
                const { body } = this.partsOf(`display-${tokenId}`, touched)
                const shown = this.slot(index)
                const from = this.slot(was)
                const to = this.slot(goes)
                timeline.fromTo(
                    poseOf(body),
                    { x: from.x - shown.x, y: from.y - shown.y },
                    {
                        x: to.x - shown.x,
                        y: to.y - shown.y,
                        duration: quick ? QUICK : CLOSE_UP.duration,
                        ease: 'power2.inOut',
                        immediateRender: false
                    },
                    quick ? 0 : CLOSE_UP.at
                )
            })
        }
        const view = this.view()
        const decks = decksOf(before, after)
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
            this.boats = []
            this.flights = []
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

    // Dug, the banks and kerbs show through the paving as it runs away like a liquid, and then the
    // water runs in the same way. Filled in, the same backwards: the water drains back the way it
    // came, then the paving runs back over the banks.
    private flood(flood: Flood, dug: boolean, timeline: Timeline, digging: boolean) {
        const paving = this.floodPavings.get(flood.key)
        if (paving === undefined) throw new Error('A dug canal is drawn before it is dug')
        timeline.set(paving, { opacity: 1 }, 0)
        const { build, water } = digging ? DIG : DIG_QUICK
        if (dug) {
            this.runIn(flood, timeline, 0, 1, build, 0, 'build')
            this.runIn(flood, timeline, 0, 1, water, build)
            this.runIn(flood, timeline, 0, 1, water, build, 'wet')
            return
        }
        this.runIn(flood, timeline, 1, 0, water, 0)
        this.runIn(flood, timeline, 1, 0, water, 0, 'wet')
        this.runIn(flood, timeline, 1, 0, build, water, 'build')
    }

    // Water runs into the canal from each spring as a disc; the discs, blurred and cut back to a
    // hard edge, run together like a liquid where they meet.
    private runIn(
        flood: Flood,
        timeline: Timeline,
        from: number,
        to: number,
        duration: number,
        at: number,
        kind: SpringKind = 'water'
    ) {
        flood.springs.forEach((spring, index) => {
            const node = this.springNodes.get(`${flood.key}-${kind}-${index}`)
            if (node === undefined) throw new Error('A spring is drawn before the water runs in')
            const full = {
                water: spring.reach,
                wet: spring.reach + WET_REACH,
                build: spring.cover
            }[kind]
            timeline.fromTo(
                new Disc(node),
                { r: from * full },
                { r: to * full, duration, ease: 'none', immediateRender: true },
                at
            )
        })
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
        const banks = {
            n: reach('n') > 0 ? BANK_WIDTH : 0,
            e: reach('e') > 0 ? BANK_WIDTH : 0,
            s: reach('s') > 0 ? BANK_WIDTH : 0,
            w: reach('w') > 0 ? BANK_WIDTH : 0
        }
        const foot = {
            x: floor.x + banks.w,
            y: floor.y + banks.n,
            width: floor.width - banks.w - banks.e,
            height: floor.height - banks.n - banks.s
        }
        const cove = (one: number, other: number) => (one > 0 && other > 0 ? COVE_TOE : 0)
        const coves = [
            cove(banks.n, banks.w),
            cove(banks.n, banks.e),
            cove(banks.s, banks.e),
            cove(banks.s, banks.w)
        ]
        const corners = [
            { x: foot.x, y: foot.y },
            { x: foot.x + foot.width, y: foot.y },
            { x: foot.x, y: foot.y + foot.height },
            { x: foot.x + foot.width, y: foot.y + foot.height }
        ]
        const outer = {
            x: floor.x - reach('w'),
            y: floor.y - reach('n'),
            width: floor.width + reach('w') + reach('e'),
            height: floor.height + reach('n') + reach('s')
        }
        const outerCorners = [
            { x: outer.x, y: outer.y },
            { x: outer.x + outer.width, y: outer.y },
            { x: outer.x, y: outer.y + outer.height },
            { x: outer.x + outer.width, y: outer.y + outer.height }
        ]
        const farthest = (points: { x: number; y: number }[], x: number, y: number) =>
            Math.max(...points.map((point) => Math.hypot(point.x - x, point.y - y))) + 4
        const spring = (x: number, y: number) => ({
            x,
            y,
            reach: farthest(corners, x, y),
            cover: farthest(outerCorners, x, y)
        })
        const edges = cells.flatMap((cell) =>
            steps.flatMap(([, dc, dr]) => {
                const other = cellAt(columnOf(cell) + dc, rowOf(cell) + dr)
                const wet =
                    other === undefined ||
                    (!cells.includes(other) && (!isLand(other) || water.has(other)))
                if (!wet) return []
                return [
                    spring(
                        (columnOf(cell) + 0.5 + dc / 2) * CELL,
                        (rowOf(cell) + 0.5 + dr / 2) * CELL
                    )
                ]
            })
        )
        return {
            key: cells.join('-'),
            cells,
            footPath: roundedRect(foot.x, foot.y, foot.x + foot.width, foot.y + foot.height, coves),
            springs:
                edges.length > 0
                    ? edges
                    : [spring(foot.x + foot.width / 2, foot.y + foot.height / 2)],
            box: outer
        }
    }

    // The Pilli Mexica walks its route: a small hop onto each square, a glide onto or off the
    // water of a canal it crosses, and a ride by canoe from bridge to bridge. Its group moves
    // between squares and its body hops.
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
        const voyages = voyagesOf(path, decks)
        let at = 0
        let index = 1
        while (index < path.length) {
            const voyage = voyages.find((stops) => stops[0] === index - 1)
            if (voyage !== undefined) {
                const stops = voyage.map((stop) => path[stop])
                at = this.ride(
                    `boat-${playerId}`,
                    playerId,
                    stops,
                    decks,
                    start,
                    whole,
                    body,
                    timeline,
                    at
                )
                index = voyage[voyage.length - 1] + 1
                continue
            }
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
            index++
        }
    }

    // A ride by canoe through `stops`, bridges each a boat ride from the last; returns when it
    // ends. The canoe follows the water from square to square, and where the way runs round the
    // island beyond the board's edge, it paddles off the board and back on where the water
    // joins again. `start` is where the Pilli Mexica stood before its move, which its group's
    // pose is measured from.
    private ride(
        key: string,
        playerId: string,
        stops: readonly Cell[],
        decks: ReadonlySet<Cell>,
        start: Point,
        whole: SVGGElement,
        body: SVGGElement,
        timeline: Timeline,
        from: number
    ): number {
        const view = this.view()
        const boat = this.boatNodes.get(key)
        if (boat === undefined) throw new Error(`The canoe ${key} is drawn before it sails`)
        const water = this.session.gameState.layout().canals
        const stretches = stretchesOf(stops, water, decks).map((stretch) => {
            const points = stretch.cells.map((cell) => view.centre(cell))
            if (stretch.fromOutside) points.unshift(beyondEdge(view, stretch.cells[0]))
            if (stretch.toOutside)
                points.push(beyondEdge(view, stretch.cells[stretch.cells.length - 1]))
            const course = courseOf(points)
            const offset = stretch.fromOutside ? 1 : 0
            const passed = stretch.cells.flatMap((cell, index) =>
                stops.slice(1, -1).includes(cell) ? [course.at[index + offset]] : []
            )
            return { ...stretch, course, offset, passed }
        })
        const sink = BOAT.sink * view.tilt
        const deck = view.lift(BRIDGE_RISE)
        const wholePose = poseOf(whole)
        const bodyPose = poseOf(body)
        const place = (course: Course, distance: number) => {
            const { point, heading } = course.pointAt(distance)
            const ground = Math.atan2(heading.y / view.tilt, heading.x)
            const [cos, sin] = [Math.cos(ground), Math.sin(ground)]
            boat.setAttribute(
                'transform',
                `matrix(${cos} ${sin * view.tilt} ${-sin} ${cos * view.tilt} ${point.x} ${point.y})`
            )
            return point
        }
        // Where the canoe sets off and stops on each stretch: short of the bridges at either
        // end, and from or to beyond the board's edge.
        const ends = stretches.map((stretch, index) => {
            const length = stretch.course.length
            const first = index === 0 ? BOAT.off * CELL : 0
            const last = index === stretches.length - 1 ? length - BOAT.off * CELL : length
            return last > first ? { first, last } : { first: length / 2, last: length / 2 }
        })
        // The canoe slides out from under the first bridge, the Pilli hops down into it.
        const outset = stretches[0].course
        const board = outset.pointAt(ends[0].first).point
        const emerging = { distance: 0 }
        place(outset, 0)
        gsap.set(boat, { opacity: 0 })
        timeline.to(
            emerging,
            {
                distance: ends[0].first,
                duration: BOAT.emerge,
                ease: 'power2.out',
                onUpdate: () => void place(outset, emerging.distance)
            },
            from
        )
        timeline.to(boat, { opacity: 1, duration: BOAT.emerge * 0.6, ease: 'none' }, from)
        const aboard = from + BOAT.emerge * 0.55
        timeline.to(
            wholePose,
            { x: board.x - start.x, y: board.y + sink - start.y, duration: BOAT.hop, ease: 'none' },
            aboard
        )
        timeline.to(
            bodyPose,
            { y: WALK.height, duration: BOAT.hop / 2, ease: 'power1.out' },
            aboard
        )
        timeline.to(
            bodyPose,
            { y: 0, duration: BOAT.hop / 2, ease: 'power1.in' },
            aboard + BOAT.hop / 2
        )
        // Paddled along the water, hopping over each bridge on the way.
        let at = aboard + BOAT.hop
        let square = -1
        stretches.forEach((stretch, index) => {
            const { first, last } = ends[index]
            const course = stretch.course
            if (index > 0) {
                // Back onto the board where the water joins again.
                timeline.call(() => void place(course, first), undefined, at)
                timeline.to([boat, whole], { opacity: 1, duration: BOAT.show, ease: 'none' }, at)
            }
            const duration = Math.max(BOAT.least, ((last - first) / CELL) * BOAT.cell)
            const travel = { distance: first }
            timeline.to(
                travel,
                {
                    distance: last,
                    duration,
                    ease:
                        stretches.length === 1
                            ? 'sine.inOut'
                            : index === 0
                              ? 'sine.in'
                              : index === stretches.length - 1
                                ? 'sine.out'
                                : 'none',
                    onUpdate: () => {
                        const point = place(course, travel.distance)
                        wholePose.x = point.x - start.x
                        wholePose.y = point.y + sink - start.y
                        let over = 0
                        for (const bridge of stretch.passed) {
                            const u = (travel.distance - bridge + CELL * 0.8) / (CELL * 1.6)
                            if (u > 0 && u < 1)
                                over = Math.sin(Math.PI * u) * (deck + sink + BOAT.over)
                        }
                        bodyPose.y = -over
                        const near = course.squareAt(travel.distance) - stretch.offset
                        const cell =
                            stretch.cells[Math.max(0, Math.min(stretch.cells.length - 1, near))]
                        if (cell !== square) {
                            square = cell
                            this.walking = new Map([...this.walking, [playerId, cell]])
                        }
                    }
                },
                at
            )
            at += duration
            if (stretch.toOutside) {
                // Off round the island beyond the board's edge.
                timeline.to(
                    [boat, whole],
                    { opacity: 0, duration: BOAT.show, ease: 'none' },
                    at - BOAT.show
                )
            }
        })
        // At the last bridge the Pilli hops up onto the deck and the canoe slides back under.
        const landing = at
        const inset = stretches[stretches.length - 1].course
        const going = { distance: ends[ends.length - 1].last }
        const under = landing + BOAT.hop * 0.4
        timeline.to(
            going,
            {
                distance: inset.length,
                duration: BOAT.emerge,
                ease: 'power2.in',
                onUpdate: () => void place(inset, going.distance)
            },
            under
        )
        const end = pilliSpot(view, stops[stops.length - 1], decks)
        timeline.to(
            wholePose,
            { x: end.x - start.x, y: end.y - start.y, duration: BOAT.hop, ease: 'none' },
            landing
        )
        timeline.to(
            bodyPose,
            { y: WALK.height - deck, duration: BOAT.hop / 2, ease: 'power1.out' },
            landing
        )
        timeline.to(
            bodyPose,
            { y: 0, duration: BOAT.hop / 2, ease: 'power1.in' },
            landing + BOAT.hop / 2
        )
        timeline.to(
            boat,
            { opacity: 0, duration: BOAT.emerge * 0.6, ease: 'none' },
            under + BOAT.emerge * 0.4
        )
        timeline.call(
            () => {
                this.walking = new Map([...this.walking, [playerId, stops[stops.length - 1]]])
            },
            undefined,
            landing + BOAT.hop / 2
        )
        return Math.max(landing + BOAT.hop, under + BOAT.emerge)
    }

    // A district founded: its token lifts off the Emperor's display, fading, and drops onto its
    // square with a bounce, behind any temple in front of it.
    private found(
        district: District,
        index: number,
        timeline: Timeline,
        touched: SVGGElement[],
        quick: boolean
    ) {
        const flight = `flight-${district.tokenId}`
        const shown = `display-${district.tokenId}`
        if (!quick) {
            this.liftOff(shown, timeline, touched, LIFT_OFF.duration)
            this.drop(
                `token-${district.tokenId}`,
                timeline,
                touched,
                DROP.fall,
                true,
                LIFT_OFF.duration * 0.6
            )
            return
        }
        // Without an action it slides from the display straight to its square.
        const { body } = this.partsOf(flight, touched)
        const start = this.slot(index)
        const end = this.view().centre(district.cell)
        timeline.set(this.partsOf(shown, touched).body, { opacity: 0 }, 0)
        timeline.fromTo(
            poseOf(body),
            { x: start.x - end.x, y: start.y - end.y, scale: DISPLAY_SCALE },
            { x: 0, y: 0, scale: 1, duration: QUICK, ease: 'power1.inOut' },
            0
        )
    }

    // A founding undone: the token goes back to its place on the display.
    private unfound(district: District, index: number, timeline: Timeline, touched: SVGGElement[]) {
        const flight = `flight-${district.tokenId}`
        const shown = `display-${district.tokenId}`
        const { body } = this.partsOf(flight, touched)
        const start = this.view().centre(district.cell)
        const end = this.slot(index)
        timeline.set(this.partsOf(shown, touched).body, { opacity: 0 }, 0)
        timeline.to(
            poseOf(body),
            {
                x: end.x - start.x,
                y: end.y - start.y,
                scale: DISPLAY_SCALE,
                duration: QUICK,
                ease: 'power1.inOut'
            },
            0
        )
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
            districts: state.districts,
            // The display reads by value, smallest first, left to right then down.
            display: state.display.toSorted((a, b) => tokenSize(a) - tokenSize(b) || a - b),
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

function decksOf(before: DrawnBoard, after: DrawnBoard): Set<Cell> {
    return new Set([...before.bridges, ...after.bridges].map((bridge) => bridge.cell))
}

// The boat rides in a route: runs of its indices that go bridge to bridge, each run from the
// bridge the ride starts on to the one it ends on. From a bridge to the one beside it the Pilli
// Mexica just hops across.
function voyagesOf(path: readonly Cell[], decks: ReadonlySet<Cell>): number[][] {
    const voyages: number[][] = []
    for (let index = 1; index < path.length; index++) {
        if (!decks.has(path[index - 1]) || !decks.has(path[index])) continue
        if (areAdjacent(path[index - 1], path[index])) continue
        const current = voyages[voyages.length - 1]
        if (current !== undefined && current[current.length - 1] === index - 1) current.push(index)
        else voyages.push([index - 1, index])
    }
    return voyages
}

// The water a boat crosses through `stops`, bridges each a ride from the last: along canals,
// under no other bridge, and across the lake. The lake joins round the island beyond the
// board's edge, so the way may leave the board and come back on elsewhere: it comes in
// stretches, each marked where it leaves or comes back. Going round costs `ROUND_ISLAND`
// squares, so a way on the board is taken when there is one.
type Stretch = { cells: Cell[]; fromOutside: boolean; toOutside: boolean }
const OUTSIDE = -1
const ROUND_ISLAND = 12
const LAKE_CELLS = Array.from({ length: CELL_COUNT }, (_, cell) => cell).filter(isLake)

function stretchesOf(
    stops: readonly Cell[],
    canals: ReadonlySet<Cell>,
    decks: ReadonlySet<Cell>
): Stretch[] {
    const way = stops.flatMap((stop, index) =>
        index === 0 ? [stop] : waterWay(stops[index - 1], stop, canals, decks).slice(1)
    )
    const stretches: Stretch[] = [{ cells: [], fromOutside: false, toOutside: false }]
    for (const cell of way) {
        const current = stretches[stretches.length - 1]
        if (cell === OUTSIDE) {
            current.toOutside = true
            stretches.push({ cells: [], fromOutside: true, toOutside: false })
        } else {
            current.cells.push(cell)
        }
    }
    return stretches.filter((stretch) => stretch.cells.length > 0)
}

function waterWay(
    from: Cell,
    to: Cell,
    canals: ReadonlySet<Cell>,
    decks: ReadonlySet<Cell>
): Cell[] {
    const afloat = (cell: Cell) =>
        cell === to || isLake(cell) || (canals.has(cell) && !decks.has(cell))
    const atEdge = (cell: Cell) => neighbours(cell).length < 4
    const edges = [...canals, ...LAKE_CELLS].filter((cell) => atEdge(cell) && afloat(cell))
    const nextTo = (cell: Cell): [Cell, number][] =>
        cell === OUTSIDE
            ? edges.map((edge) => [edge, ROUND_ISLAND])
            : [
                  ...neighbours(cell)
                      .filter(afloat)
                      .map((next): [Cell, number] => [next, 1]),
                  ...(atEdge(cell) ? [[OUTSIDE, ROUND_ISLAND] as [Cell, number]] : [])
              ]
    const cost = new Map<Cell, number>([[from, 0]])
    const previous = new Map<Cell, Cell>()
    const open = new Set<Cell>([from])
    while (open.size > 0) {
        let cell = OUTSIDE
        let best = Infinity
        for (const candidate of open) {
            const c = cost.get(candidate) ?? Infinity
            if (c < best) {
                best = c
                cell = candidate
            }
        }
        open.delete(cell)
        if (cell === to) break
        for (const [next, step] of nextTo(cell)) {
            if (best + step >= (cost.get(next) ?? Infinity)) continue
            cost.set(next, best + step)
            previous.set(next, cell)
            open.add(next)
        }
    }
    if (!cost.has(to)) return [from, to]
    const way = [to]
    while (way[0] !== from) way.unshift(previous.get(way[0]) ?? from)
    return way
}

// A point a square beyond the board's edge from `cell` on it.
function beyondEdge(view: BoardView, cell: Cell): Point {
    const centre = view.centre(cell)
    for (const direction of DIRECTIONS) {
        if (neighbour(cell, direction) !== undefined) continue
        const across = neighbour(cell, OPPOSITE[direction])
        if (across === undefined) continue
        const inward = view.centre(across)
        return { x: 2 * centre.x - inward.x, y: 2 * centre.y - inward.y }
    }
    return centre
}

const OPPOSITE: Record<Direction, Direction> = {
    [Direction.North]: Direction.South,
    [Direction.South]: Direction.North,
    [Direction.East]: Direction.West,
    [Direction.West]: Direction.East
}

type Course = {
    length: number
    // How far along the course each of its squares' middles lies.
    at: number[]
    pointAt(distance: number): { point: Point; heading: Point }
    squareAt(distance: number): number
}

// A course through the middles of squares on screen, its corners rounded so a canoe turns them
// smoothly: the heading eases from one leg's direction to the next over `ROUNDING` of a square.
const ROUNDING = 0.35

function courseOf(points: readonly Point[]): Course {
    const at = [0]
    for (let index = 1; index < points.length; index++) {
        const a = points[index - 1]
        const b = points[index]
        at.push(at[index - 1] + Math.hypot(b.x - a.x, b.y - a.y))
    }
    const length = at[at.length - 1]
    const legOf = (distance: number) => {
        let leg = 0
        while (leg < points.length - 2 && at[leg + 1] < distance) leg++
        return leg
    }
    const direction = (leg: number): Point => {
        const a = points[leg]
        const b = points[leg + 1]
        const size = Math.hypot(b.x - a.x, b.y - a.y) || 1
        return { x: (b.x - a.x) / size, y: (b.y - a.y) / size }
    }
    return {
        length,
        at,
        pointAt(distance) {
            const leg = legOf(distance)
            const a = points[leg]
            const b = points[leg + 1] ?? a
            const span = at[leg + 1] - at[leg] || 1
            const t = Math.min(1, Math.max(0, (distance - at[leg]) / span))
            let point = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
            let heading = direction(leg)
            const round = ROUNDING * CELL
            // Near the corner ahead, cut it on a curve and turn towards the next leg.
            if (leg < points.length - 2 && at[leg + 1] - distance < round) {
                const next = direction(leg + 1)
                const k = (1 - (at[leg + 1] - distance) / round) / 2
                point = cornerPoint(points[leg + 1], heading, next, round, k)
                heading = blendHeading(heading, next, k)
            } else if (leg > 0 && distance - at[leg] < round) {
                const before = direction(leg - 1)
                const k = 0.5 + (distance - at[leg]) / round / 2
                point = cornerPoint(points[leg], before, heading, round, k)
                heading = blendHeading(before, heading, k)
            }
            return { point, heading }
        },
        squareAt(distance) {
            let nearest = 0
            for (let index = 1; index < at.length; index++) {
                if (Math.abs(at[index] - distance) < Math.abs(at[nearest] - distance))
                    nearest = index
            }
            return nearest
        }
    }
}

// A point `k` of the way round the curve cutting the corner at `corner`, from `round` before it
// on the leg heading `into` to `round` after it on the leg heading `out`.
function cornerPoint(corner: Point, into: Point, out: Point, round: number, k: number): Point {
    const a = { x: corner.x - into.x * round, y: corner.y - into.y * round }
    const b = { x: corner.x + out.x * round, y: corner.y + out.y * round }
    const u = 1 - k
    return {
        x: u * u * a.x + 2 * u * k * corner.x + k * k * b.x,
        y: u * u * a.y + 2 * u * k * corner.y + k * k * b.y
    }
}

function blendHeading(a: Point, b: Point, k: number): Point {
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }
}
