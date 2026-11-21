import { tick } from 'svelte'
import type { Attachment } from 'svelte/attachments'
import { gsap } from 'gsap'
import type {
    AnimationContext,
    TransitionKind,
    TransitionStep
} from '@tabletop/frontend-components'
import {
    ALLIANCES,
    COUNTRY_NAMES,
    ROADS,
    isScoreFinal,
    isScoreInterim,
    type Award,
    type Country,
    type HydratedWebOfPowerGameState
} from '@tabletop/web-of-power'
import type { MoveInterrupter, WebOfPowerGameSession } from '$lib/model/session.svelte.js'
import { ALLIANCE_BOXES, ARMS, SPACE_POINTS } from '$lib/board/mapData.js'
import { ARMS_R } from '$lib/board/advisorSpots.js'
import { poseOf, setPose } from './svgPose.js'

const ANIMATED_KINDS: ReadonlySet<TransitionKind> = new Set<TransitionKind>([
    'own-action',
    'other-action',
    'history',
    'exploration'
])

const BEAT = { step: 1, light: 0.24, chip: 0.3, count: 0.4, hold: 1, fade: 0.3 }
const CHAIN = { road: 0.2, hold: 0.8 }

type Step = TransitionStep<HydratedWebOfPowerGameState, AnimationContext>

export type ScoringBeat = {
    key: string
    countries: Country[]
    alliance?: number
    roads: { key: string; reversed: boolean }[]
    chipsAt: { x: number; y: number }
    awards: Award[]
    label: string
}

export class ScoringAnimator implements MoveInterrupter {
    beats: ScoringBeat[] = $state.raw([])
    scores: ReadonlyMap<string, number> | undefined = $state.raw()
    heading: string | undefined = $state()
    label: string | undefined = $state()

    private readonly nodes = new Map<string, SVGElement>()
    private readonly listener = (step: Step) => this.onGameStateChange(step)
    private readonly tweened = new Set<object>()
    private landMove: (() => void) | undefined
    private timeline: gsap.core.Timeline | undefined

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
        this.stop()
    }

    part(name: string): Attachment<SVGElement> {
        return (node) => {
            this.nodes.set(name, node)
            return () => {
                if (this.nodes.get(name) === node) this.nodes.delete(name)
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
            this.beats = []
            this.scores = undefined
            this.heading = undefined
            this.label = undefined
            throw error
        }
    }

    private beatsOf(action: Step['action']): ScoringBeat[] {
        if (!isScoreInterim(action) && !isScoreFinal(action)) return []
        const result = action.metadata
        if (result === undefined) return []
        const below = (country: Country) => ({
            x: ARMS[country].x,
            y: ARMS[country].y + ARMS_R + 16
        })
        const beats: ScoringBeat[] = result.cloisters
            .filter(({ awards }) => awards.length > 0)
            .map(({ country, awards }) => ({
                key: `country-${country}`,
                countries: [country],
                roads: [],
                chipsAt: below(country),
                awards,
                label: COUNTRY_NAMES[country]
            }))
        if (isScoreFinal(action) && action.metadata) {
            for (const { alliance, awards } of action.metadata.alliances) {
                const box = ALLIANCE_BOXES[alliance]
                beats.push({
                    key: `alliance-${alliance}`,
                    countries: [...ALLIANCES[alliance - 1]],
                    alliance,
                    roads: [],
                    chipsAt: { x: box.x, y: box.y + 48 },
                    awards,
                    label: `Alliance ${alliance}, ${ALLIANCES[alliance - 1].map((c) => COUNTRY_NAMES[c]).join(' and ')}`
                })
            }
            action.metadata.chains.forEach(({ playerId, abbeys }, index) => {
                const roads = abbeys.slice(1).map((abbey, i) => {
                    const a = abbeys[i]
                    const forward = ROADS.some(([x, y]) => x === a && y === abbey)
                    return { key: forward ? `${a}|${abbey}` : `${abbey}|${a}`, reversed: !forward }
                })
                const end = SPACE_POINTS[abbeys[abbeys.length - 1]]
                beats.push({
                    key: `chain-${index}`,
                    countries: [],
                    roads,
                    chipsAt: { x: end.x, y: end.y + 36 },
                    awards: [{ playerId, points: abbeys.length }],
                    label: `${this.session.getPlayerName(playerId)}'s chain of ${abbeys.length}`
                })
            })
        }
        return beats
    }

    private async present({ kind, from, action, animationContext }: Step) {
        // A scoring shows only as it happens; Undo and a step back land it at once.
        if (from === undefined || !ANIMATED_KINDS.has(kind) || action === undefined) return
        const beats = this.beatsOf(action)
        if (beats.length === 0) return
        const scores = new Map(from.players.map((player) => [player.playerId, player.score]))
        this.scores = new Map(scores)
        this.beats = beats
        this.heading = isScoreFinal(action) ? 'Final scoring' : 'Interim scoring'
        this.label = undefined
        await tick()

        const timeline = gsap.timeline()
        animationContext.actionTimeline.add(timeline, 0)
        this.timeline = timeline
        const touched: SVGElement[] = []
        const nodeOf = (name: string) => {
            const node = this.nodes.get(name)
            if (node === undefined) throw Error(`Scoring part ${name} is drawn before it plays`)
            touched.push(node)
            this.tweened.add(node)
            return node
        }
        let at = 0
        for (const beat of beats) {
            const start = at
            const roadsTime = beat.roads.length * CHAIN.road
            const showFor = beat.roads.length > 0 ? roadsTime + CHAIN.hold : BEAT.hold
            const label = beat.label
            timeline.call(() => (this.label = label), undefined, start)
            if (beat.countries.length > 0 || beat.alliance !== undefined) {
                const light = nodeOf(`light:${beat.key}`)
                timeline.fromTo(
                    light,
                    { opacity: 0 },
                    { opacity: 1, duration: BEAT.light, ease: 'power1.out', immediateRender: true },
                    start
                )
                timeline.to(
                    light,
                    { opacity: 0, duration: BEAT.fade, ease: 'power1.in' },
                    start + showFor
                )
            }
            beat.roads.forEach((road, index) => {
                const node = nodeOf(`road:${beat.key}:${index}`)
                timeline.fromTo(
                    node,
                    { strokeDashoffset: road.reversed ? -1 : 1, opacity: 1 },
                    {
                        strokeDashoffset: 0,
                        duration: CHAIN.road,
                        ease: 'none',
                        immediateRender: true
                    },
                    start + index * CHAIN.road
                )
                timeline.to(node, { opacity: 0, duration: BEAT.fade }, start + showFor)
            })
            const chips = nodeOf(`chips:${beat.key}`)
            const pose = poseOf(chips)
            this.tweened.add(pose)
            const chipAt = start + (beat.roads.length > 0 ? roadsTime : BEAT.light * 0.5)
            timeline.fromTo(
                chips,
                { opacity: 0 },
                { opacity: 1, duration: 0.1, ease: 'none', immediateRender: true },
                chipAt
            )
            timeline.fromTo(
                pose,
                { scale: 0.4, y: 6 },
                { scale: 1, y: 0, duration: BEAT.chip, ease: 'back.out(2)', immediateRender: true },
                chipAt
            )
            timeline.to(
                chips,
                { opacity: 0, duration: BEAT.fade, ease: 'power1.in' },
                start + showFor
            )
            timeline.to(pose, { y: -8, duration: BEAT.fade, ease: 'power1.in' }, start + showFor)
            const awards = beat.awards
            timeline.call(
                () => {
                    for (const { playerId, points } of awards) {
                        scores.set(playerId, (scores.get(playerId) ?? 0) + points)
                    }
                    this.scores = new Map(scores)
                },
                undefined,
                chipAt + BEAT.count
            )
            at = start + (beat.roads.length > 0 ? showFor : BEAT.step)
        }
        timeline.set({}, {}, at + BEAT.fade)

        const land = () => {
            if (this.landMove === land) this.landMove = undefined
            if (this.timeline === timeline) this.timeline = undefined
            this.tweened.clear()
            for (const node of touched) {
                setPose(node, { x: 0, y: 0, scale: 1 })
                gsap.set(node, { clearProps: 'opacity,strokeDashoffset' })
            }
            this.beats = []
            this.scores = undefined
            this.heading = undefined
            this.label = undefined
        }
        this.landMove = land
        animationContext.afterAnimations(land)
    }
}
