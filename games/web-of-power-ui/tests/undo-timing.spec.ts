import { expect, test, type Page } from '@playwright/test'
import {
    chooseCard,
    deck,
    expectNoErrors,
    market,
    openScenario,
    placeFirst,
    settle,
    watchErrors
} from './harness.js'

// A step without an action (Undo, another player's Undo, a history step) must finish its motion
// within 0.2 s. Each AnimationContext the presenter makes records when its motion ends.

type Step = { kind: string; action: string; end: number }

declare global {
    interface Window {
        steps: Step[]
    }
}

const ACTIONLESS_BUDGET = 0.2

test.beforeEach(({ page }) => watchErrors(page))
test.afterEach(({ page }) => expectNoErrors(page))

async function timeSteps(page: Page) {
    await page.evaluate(() => {
        window.steps = []
        // The presenter is the session's own; the spec reaches in to time each step.
        const presenter = Reflect.get(window.wopSession, 'presenter')
        const deps = Reflect.get(presenter, 'deps')
        const create = deps.createAnimationContext
        deps.createAnimationContext = () => {
            const context = create()
            const step: Step = { kind: '', action: '', end: 0 }
            window.steps.push(step)
            const play = context.play.bind(context)
            context.play = async () => {
                const children: { startTime(): number; duration(): number }[] = [
                    ...context.actionTimeline.getChildren(false),
                    ...context.finalTimeline.getChildren(false)
                ]
                step.end = Math.max(0, ...children.map((c) => c.startTime() + c.duration()))
                return play()
            }
            context.step = step
            return context
        }
        window.wopSession.addGameStateChangeListener(async ({ kind, action, animationContext }) => {
            const step: Step = Reflect.get(animationContext, 'step')
            step.kind = kind
            step.action = action?.type ?? '-'
        })
    })
}

async function act(page: Page, run: () => unknown) {
    await page.evaluate(run)
    await settle(page)
}

async function expectActionlessWithinBudget(page: Page) {
    const steps = await page.evaluate(() => window.steps)
    const actionless = steps.filter((step) => step.action === '-' && step.kind !== '')
    expect(actionless.length).toBeGreaterThan(0)
    for (const step of actionless) {
        expect(step.end, `${step.kind} step`).toBeLessThanOrEqual(ACTIONLESS_BUDGET)
    }
}

test('your own Undo of a placement and of a market draw', async ({ page }) => {
    await openScenario(page, 'Late game')
    await chooseCard(page)
    await placeFirst(page)
    await timeSteps(page)
    await act(page, () => window.wopSession.undo())
    await chooseCard(page)
    await placeFirst(page)
    await chooseCard(page)
    await placeFirst(page)
    await market(page).first().click()
    await settle(page)
    await act(page, () => window.wopSession.undo())
    await expectActionlessWithinBudget(page)
})

test("another player's Undo of a placement", async ({ page }) => {
    await openScenario(page, 'Late game')
    await chooseCard(page)
    await placeFirst(page)
    await timeSteps(page)
    // As another client sees an Undo: no move of this session's is being taken back.
    await page.evaluate(() => {
        window.wopSession.willUndo = () => {}
    })
    await act(page, () => window.wopSession.undo())
    await expectActionlessWithinBudget(page)
})

test('history steps back and forward, and jumps to either end, across turns', async ({ page }) => {
    await openScenario(page, 'Late game')
    await chooseCard(page)
    await placeFirst(page)
    await chooseCard(page)
    await placeFirst(page)
    await market(page).first().click()
    await settle(page)
    await deck(page).click()
    await settle(page)
    await timeSteps(page)
    await act(page, () => window.wopSession.history.goToPreviousAction())
    await act(page, () => window.wopSession.history.goToPreviousAction())
    await act(page, () => window.wopSession.history.goToNextAction())
    await act(page, () => window.wopSession.history.goToBeginning())
    await act(page, () => window.wopSession.history.goToEnd())
    await expectActionlessWithinBudget(page)
})

test('a history step back across the interim scoring lands it at once', async ({ page }) => {
    await openScenario(page, 'Interim scoring')
    await chooseCard(page)
    await placeFirst(page)
    if (await page.getByRole('button', { name: 'Done', exact: true }).isVisible()) {
        await page.getByRole('button', { name: 'Done', exact: true }).click()
        await settle(page)
    }
    await deck(page).click()
    await settle(page, { timeout: 40_000 })
    await timeSteps(page)
    await act(page, () => window.wopSession.history.goToPreviousAction())
    await act(page, () => window.wopSession.history.goToNextAction())
    await expectActionlessWithinBudget(page)
})
