import { expect, test, type Page } from '@playwright/test'
import {
    chooseCard,
    deck,
    expectNoErrors,
    openScenario,
    settle,
    SCORING,
    targets,
    watchErrors
} from './harness.js'

// Firefox 140 leaves the offset of an SVG matrix() transform out of a CSS zoom, and the board is
// drawn under one at view scale, so nothing on the board may move by a matrix() with an offset.
// Each step is sampled frame by frame on a paused clock.

test.beforeEach(({ page }) => watchErrors(page))
test.afterEach(({ page }) => expectNoErrors(page))

function offsetMatrices(page: Page) {
    return page.evaluate(() =>
        [...document.querySelectorAll('svg.wop-board *')]
            .flatMap(
                (node) =>
                    `${node.getAttribute('transform') ?? ''} ${node.getAttribute('style') ?? ''}`.match(
                        /matrix\([^)]*\)/g
                    ) ?? []
            )
            .filter((matrix) => {
                const values = matrix.slice(7, -1).split(/[ ,]+/).map(Number)
                return values[4] !== 0 || values[5] !== 0
            })
    )
}

async function expectNoOffsetMatrix(
    page: Page,
    step: () => Promise<unknown>,
    { frames = 45, frame = 20, timeout = 5_000 } = {}
) {
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 500))
    await page.clock.runFor(20)
    await step()
    const drawn: string[] = []
    for (let i = 0; i <= frames; i++) {
        drawn.push(...(await offsetMatrices(page)))
        await page.clock.runFor(frame)
    }
    await page.clock.resume()
    await settle(page, { timeout })
    drawn.push(...(await offsetMatrices(page)))
    expect(drawn).toEqual([])
}

// Chooses a card that can found a cloister or send an advisor, and returns that target's name.
async function targetOf(page: Page, kind: 'found a cloister' | 'send an advisor') {
    const cards = page.locator('[aria-label="Your hand"] button.card.choosable')
    for (let i = 0; i < (await cards.count()); i++) {
        await cards.nth(i).click()
        await settle(page)
        const name = await targets(page)
            .and(page.locator(`[aria-label^="${kind}"]`))
            .first()
            .getAttribute('aria-label', { timeout: 500 })
            .catch(() => null)
        if (name !== null) return name
    }
    throw Error(`No card in hand can ${kind}`)
}

const press = (page: Page, name: string) => () =>
    page.getByRole('button', { name, exact: true }).press('Enter')
const run = (page: Page, script: () => unknown) => () => page.evaluate(script)

test('drops, Undo and history steps move without an offset matrix()', async ({ page }) => {
    await openScenario(page, 'Late game', { clock: true })
    await expectNoOffsetMatrix(page, press(page, await targetOf(page, 'found a cloister')))
    await expectNoOffsetMatrix(
        page,
        run(page, () => window.wopSession.undo())
    )
    await expectNoOffsetMatrix(page, press(page, await targetOf(page, 'send an advisor')))
    await expectNoOffsetMatrix(
        page,
        run(page, () => window.wopSession.undo())
    )
    await expectNoOffsetMatrix(page, press(page, await targetOf(page, 'found a cloister')))
    await expectNoOffsetMatrix(
        page,
        run(page, () => window.wopSession.history.goToPreviousAction())
    )
    await expectNoOffsetMatrix(
        page,
        run(page, () => window.wopSession.history.goToEnd())
    )
})

test('the interim scoring plays without an offset matrix()', async ({ page }) => {
    await openScenario(page, 'Interim scoring', { clock: true })
    await chooseCard(page)
    const name = await targets(page).first().getAttribute('aria-label')
    await page.getByRole('button', { name: name ?? '', exact: true }).press('Enter')
    await settle(page)
    if (await page.getByRole('button', { name: 'Done', exact: true }).isVisible()) {
        await page.getByRole('button', { name: 'Done', exact: true }).click()
        await settle(page)
    }
    await expectNoOffsetMatrix(page, () => deck(page).click(), {
        frames: 120,
        frame: 100,
        timeout: SCORING.timeout
    })
})
