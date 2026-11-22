import { expect, test, type Page } from '@playwright/test'
import {
    choices,
    digFirstCanal,
    expectNoErrors,
    openScenario,
    pickTool,
    press,
    settle,
    watchErrors
} from './harness.js'

// Firefox 140 leaves the offset of an SVG matrix() transform out of a CSS zoom, and the board is
// drawn under one at view scale, so no matrix() on the board may carry an offset; the view's
// tilt is one with none. Each step is sampled frame by frame on a paused clock.

test.beforeEach(({ page }) => watchErrors(page))
test.afterEach(({ page }) => expectNoErrors(page))

function matrices(page: Page) {
    return page.evaluate(() =>
        [...document.querySelectorAll('svg.mx-board *')]
            .map(
                (node) =>
                    `${node.getAttribute('transform') ?? ''} ${node.getAttribute('style') ?? ''}`
            )
            .filter((drawn) =>
                [...drawn.matchAll(/matrix\(([^)]*)\)/g)].some((match) => {
                    const [, , , , e, f] = match[1].split(/[\s,]+/).map(Number)
                    return e !== 0 || f !== 0
                })
            )
    )
}

async function expectNoMatrix(page: Page, step: () => Promise<unknown>, frames = 120) {
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 500))
    await page.clock.runFor(20)
    await step()
    const drawn: string[] = []
    for (let i = 0; i <= frames; i++) {
        drawn.push(...(await matrices(page)))
        await page.clock.runFor(20)
    }
    await page.clock.resume()
    await settle(page)
    drawn.push(...(await matrices(page)))
    expect(drawn).toEqual([])
}

const history = (page: Page, step: 'goToPreviousAction' | 'goToBeginning' | 'goToEnd') => () =>
    page.evaluate((name) => void window.mexicaSession.history[name](), step)

test('a walk, a dig, Undo and history steps move without matrix()', async ({ page }) => {
    await openScenario(page, 'Middle game', { clock: true })
    const [to] = await choices(page)
    await expectNoMatrix(page, () => press(page, to))
    await pickTool(page, 'Canal (1 AP)')
    const [first] = await choices(page)
    await press(page, first)
    const second = (await choices(page)).find((name) => name !== first) ?? first
    await expectNoMatrix(page, () => press(page, second))
    await expectNoMatrix(page, history(page, 'goToPreviousAction'))
    await expectNoMatrix(page, history(page, 'goToBeginning'))
    await expectNoMatrix(page, history(page, 'goToEnd'))
    await expectNoMatrix(page, () => page.evaluate(() => void window.mexicaSession.undo()))
})

test('a canoe ride and a founding move without matrix()', async ({ page }) => {
    await openScenario(page, 'Canal rides', { clock: true })
    const ride = await page.evaluate(() => {
        const session = window.mexicaSession
        const far = [...session.moves].sort(([, a], [, b]) => b.cost - a.cost)[0]
        return far === undefined ? undefined : far[0]
    })
    expect(ride).toBeDefined()
    await expectNoMatrix(
        page,
        () => page.evaluate((cell) => void window.mexicaSession.chooseCell(cell ?? 0), ride),
        300
    )

    await openScenario(page, 'Founding', { clock: true })
    await press(page, 'Found the district with this token')
    await expectNoMatrix(page, () => press(page, 'D3'), 200)
})

test('a dig is undone without matrix()', async ({ page }) => {
    await openScenario(page, 'Middle game', { clock: true })
    await digFirstCanal(page)
    await expectNoMatrix(page, () => page.evaluate(() => void window.mexicaSession.undo()))
})
