import { expect, test, type Page } from '@playwright/test'
import {
    digFirstCanal,
    expectNoErrors,
    moveToFirstChoice,
    openScenario,
    settle,
    watchErrors
} from './harness.js'

// A step without an action (Undo, another player's Undo, a history step) must finish its motion
// within 0.2 s; a canal's included, the paving closing from halfway through the water draining.
// Each may wait up to DRAW_WAIT for the board to draw first. Each AnimationContext the
// presenter makes records when its motion ends.

type Step = { kind: string; action: string; end: number }

declare global {
    interface Window {
        steps: Step[]
    }
}

const ACTIONLESS_BUDGET = 0.2
const DRAW_WAIT = 0.01

test.beforeEach(({ page }) => watchErrors(page))
test.afterEach(({ page }) => expectNoErrors(page))

async function timeSteps(page: Page) {
    await page.evaluate(() => {
        window.steps = []
        // The presenter is the session's own; the spec reaches in to time each step.
        const presenter = Reflect.get(window.mexicaSession, 'presenter')
        const deps = Reflect.get(presenter, 'deps')
        const create = deps.createAnimationContext
        deps.createAnimationContext = () => {
            const context = create()
            const step: Step = { kind: '', action: '', end: 0 }
            window.steps.push(step)
            const play = context.play.bind(context)
            context.play = async () => {
                const children: { startTime(): number; duration(): number }[] =
                    context.actionTimeline.getChildren(false)
                step.end = Math.max(0, ...children.map((c) => c.startTime() + c.duration()))
                return play()
            }
            context.step = step
            return context
        }
        window.mexicaSession.addGameStateChangeListener(
            async ({ kind, action, animationContext }) => {
                const step: Step = Reflect.get(animationContext, 'step')
                step.kind = kind
                step.action = action?.type ?? '-'
            }
        )
    })
}

async function act(page: Page, run: () => unknown) {
    await page.evaluate(run)
    await settle(page)
}

async function expectActionlessWithin(page: Page, budget: number) {
    const steps = await page.evaluate(() => window.steps)
    const actionless = steps.filter((step) => step.action === '-' && step.kind !== '')
    expect(actionless.length).toBeGreaterThan(0)
    for (const step of actionless) {
        expect(step.end, `${step.kind} step`).toBeLessThanOrEqual(budget + DRAW_WAIT)
    }
}

test('your own Undo of a walk', async ({ page }) => {
    await openScenario(page, 'Middle game')
    await moveToFirstChoice(page)
    await timeSteps(page)
    await act(page, () => window.mexicaSession.undo())
    expect(await page.evaluate(() => window.mexicaSession.gameState.actionCount)).toBe(0)
    await expectActionlessWithin(page, ACTIONLESS_BUDGET)
})

test("another player's Undo of a walk", async ({ page }) => {
    await openScenario(page, 'Middle game')
    await moveToFirstChoice(page)
    await timeSteps(page)
    // As another client sees an Undo: no move of this session's is being taken back.
    await page.evaluate(() => {
        window.mexicaSession.willUndo = () => {}
    })
    await act(page, () => window.mexicaSession.undo())
    await expectActionlessWithin(page, ACTIONLESS_BUDGET)
})

test('history steps over walks, back and forward and to either end', async ({ page }) => {
    await openScenario(page, 'Middle game')
    await moveToFirstChoice(page)
    await moveToFirstChoice(page)
    await timeSteps(page)
    await act(page, () => window.mexicaSession.history.goToPreviousAction())
    await act(page, () => window.mexicaSession.history.goToNextAction())
    await act(page, () => window.mexicaSession.history.goToBeginning())
    await act(page, () => window.mexicaSession.history.goToEnd())
    await expectActionlessWithin(page, ACTIONLESS_BUDGET)
})

test('Undo of a dug canal', async ({ page }) => {
    await openScenario(page, 'Middle game')
    await digFirstCanal(page)
    await timeSteps(page)
    // The canal tool stays picked after the dig; the first Undo lets go of it.
    await act(page, () => window.mexicaSession.undo())
    await act(page, () => window.mexicaSession.undo())
    expect(await page.evaluate(() => window.mexicaSession.gameState.actionCount)).toBe(0)
    await expectActionlessWithin(page, ACTIONLESS_BUDGET)
})
