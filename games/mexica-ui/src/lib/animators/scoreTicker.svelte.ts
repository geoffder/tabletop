import { getContext, setContext } from 'svelte'
import type { Attachment } from 'svelte/attachments'
import { gsap } from 'gsap'
import type {
    AnimationContext,
    TransitionKind,
    TransitionStep
} from '@tabletop/frontend-components'
import { type HydratedMexicaGameState, isScorePeriod, PALACE_BONUS } from '@tabletop/mexica'
import { SCORING, scoringSchedule } from '$lib/board/scoringSchedule.js'
import type { MexicaGameSession, MoveInterrupter } from '$lib/model/session.svelte.js'

// A player's score on their card counts to its new total once the action that earned it has
// played out, swelling and turning green as it counts up. At a period's end it counts each
// district's points as the board shows them.

const ANIMATED_KINDS: ReadonlySet<TransitionKind> = new Set<TransitionKind>([
    'own-action',
    'other-action',
    'undo',
    'history',
    'exploration'
])

// Seconds: the count with an action, its least and most for a big gain, and the gain's rise.
const COUNT = { least: 0.45, each: 0.06, most: 1.1 }
const SWELL = { scale: 1.3, color: '#1f8a3e', settle: 0.25 }
const QUICK = 0.18

type Step = TransitionStep<HydratedMexicaGameState, AnimationContext>

const KEY = Symbol('mexica-score-ticker')

export function setScoreTicker(ticker: ScoreTicker) {
    setContext(KEY, ticker)
}

export function getScoreTicker(): ScoreTicker | undefined {
    return getContext<ScoreTicker | undefined>(KEY)
}

export class ScoreTicker implements MoveInterrupter {
    private readonly scores = new Map<string, HTMLElement>()
    private readonly listener = (step: Step) => this.onGameStateChange(step)
    private readonly tweened = new Set<object>()

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

    // The cards are the same in any view of the board.
    interrupt() {}

    abandon() {
        this.land()
    }

    // The node a player's score is written in; its text is counted directly while it ticks.
    score(playerId: string): Attachment<HTMLElement> {
        return (node) => {
            this.scores.set(playerId, node)
            return () => {
                if (this.scores.get(playerId) === node) this.scores.delete(playerId)
            }
        }
    }

    private async onGameStateChange({ kind, from, to, action, animationContext }: Step) {
        if (from === undefined || !ANIMATED_KINDS.has(kind)) return
        const changes = to.players.flatMap((player) => {
            const was = from.getPlayerState(player.playerId).score
            return was === player.score
                ? []
                : [{ playerId: player.playerId, was, now: player.score }]
        })
        if (changes.length === 0) return
        const quick = action === undefined
        const scored = isScorePeriod(action) ? action.metadata : undefined
        if (scored !== undefined) {
            // Each award at the moment its district shows, and the palace bonus after them.
            const schedule = scoringSchedule(from, scored.districts)
            const steps = [
                ...schedule.districts.flatMap(({ score, at }) =>
                    score.awards.map((award) => ({ ...award, at }))
                ),
                ...scored.palace.map((playerId) => ({
                    playerId,
                    points: PALACE_BONUS,
                    at: schedule.palaceAt
                }))
            ]
            for (const { playerId, was } of changes) {
                this.countInSteps(
                    playerId,
                    was,
                    steps.filter((step) => step.playerId === playerId),
                    animationContext.actionTimeline
                )
            }
            animationContext.afterAnimations(() => this.land())
            return
        }
        const timeline = quick ? animationContext.actionTimeline : animationContext.finalTimeline
        for (const { playerId, was, now } of changes) {
            const node = this.scores.get(playerId)
            const text = node?.firstChild
            if (text?.nodeType !== Node.TEXT_NODE) continue
            const count = { value: was }
            const duration = quick
                ? QUICK
                : Math.min(COUNT.most, Math.max(COUNT.least, COUNT.each * Math.abs(now - was)))
            this.tweened.add(count)
            timeline.to(
                count,
                {
                    value: now,
                    duration,
                    ease: 'power1.out',
                    onUpdate: () => {
                        text.nodeValue = String(Math.round(count.value))
                    }
                },
                0
            )
            if (quick || now < was || node === undefined) continue
            this.tweened.add(node)
            timeline.to(
                node,
                {
                    scale: SWELL.scale,
                    color: SWELL.color,
                    duration: duration * 0.4,
                    ease: 'power1.out'
                },
                0
            )
            timeline.to(
                node,
                { scale: 1, color: '', duration: SWELL.settle, ease: 'power1.inOut' },
                duration
            )
        }
        animationContext.afterAnimations(() => this.land())
    }

    // A score counted up in steps, each `points` more from its time `at`, swelling from the first
    // and settling after the last.
    private countInSteps(
        playerId: string,
        was: number,
        steps: readonly { points: number; at: number }[],
        timeline: gsap.core.Timeline
    ) {
        const node = this.scores.get(playerId)
        const text = node?.firstChild
        if (node === undefined || text?.nodeType !== Node.TEXT_NODE || steps.length === 0) return
        const count = { value: was }
        this.tweened.add(count)
        this.tweened.add(node)
        let total = was
        for (const { points, at } of steps) {
            total += points
            timeline.to(
                count,
                {
                    value: total,
                    duration: SCORING.count,
                    ease: 'power1.out',
                    onUpdate: () => {
                        text.nodeValue = String(Math.round(count.value))
                    }
                },
                at
            )
        }
        const first = steps[0].at
        const last = steps[steps.length - 1].at + SCORING.count
        timeline.to(
            node,
            { scale: SWELL.scale, color: SWELL.color, duration: 0.15, ease: 'power1.out' },
            first
        )
        timeline.to(
            node,
            { scale: 1, color: '', duration: SWELL.settle, ease: 'power1.inOut' },
            last
        )
    }

    private land() {
        gsap.killTweensOf([...this.tweened])
        for (const node of this.scores.values()) gsap.set(node, { clearProps: 'transform,color' })
        this.tweened.clear()
    }
}
