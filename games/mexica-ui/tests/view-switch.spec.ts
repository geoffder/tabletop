import { expect, test } from '@playwright/test'
import {
    choices,
    expectNoErrors,
    openScenario,
    pickTool,
    press,
    settle,
    watchErrors
} from './harness.js'

// A view switch (another perspective of the game published at once) cuts short the presentation
// under way. The presenter still steps through the rest of its replay; nothing may animate it.

type Step = { action: string; end: number }

declare global {
    interface Window {
        replay: Step[]
    }
}

test.beforeEach(({ page }) => watchErrors(page))
test.afterEach(({ page }) => expectNoErrors(page))

test('a view switch between two replayed actions drops the second', async ({ page }) => {
    await openScenario(page, 'Ruled out')
    await page.evaluate(() => {
        window.replay = []
        const session = window.mexicaSession
        // The presenter is the session's own; the spec reaches in to see what each step drew.
        const presenter = Reflect.get(session, 'presenter')
        const deps = Reflect.get(presenter, 'deps')
        const create = deps.createAnimationContext
        deps.createAnimationContext = () => {
            const context = create()
            const step: Step = { action: '', end: 0 }
            window.replay.push(step)
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
        let switched = false
        session.addGameStateChangeListener(async ({ action, animationContext }) => {
            const step: Step = Reflect.get(animationContext, 'step')
            step.action = action?.type ?? '-'
            if (switched || action?.type !== 'buildTemple') return
            switched = true
            // Once the temple has landed, between the two steps, while the board is idle: the
            // same position published again, as a change of perspective would. Waiting first
            // puts this after the board's own landing, which it adds once it has drawn.
            await new Promise((resolve) => setTimeout(resolve, 50))
            animationContext.afterAnimations(() => {
                const context = Reflect.get(session, 'gameContext')
                Reflect.get(session, 'replacePrimaryGameContext').call(session, context.clone())
            })
        })
    })

    // A 3-level temple on F1 leaves no district for the display's two 4s, which then break.
    await pickTool(page, '3-level temple (3 AP)')
    const square = (await choices(page)).find((name) => name.startsWith('F1'))
    expect(square).toBeDefined()
    await press(page, square ?? '')
    await settle(page)

    const steps = await page.evaluate(() => window.replay.filter((step) => step.action !== ''))
    expect(steps.map((step) => step.action)).toEqual(['buildTemple', 'removeTokens'])
    expect(steps[0].end).toBeGreaterThan(0)
    // Nothing animates the dropped step: the board, the token flights and the score ticker all
    // leave its context empty.
    expect(steps[1].end).toBe(0)
})
