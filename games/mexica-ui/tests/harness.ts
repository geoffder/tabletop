import { expect, type Page } from '@playwright/test'
import type { MexicaGameSession } from '../src/lib/model/session.svelte.js'

declare global {
    interface Window {
        mexicaSession: MexicaGameSession
    }
}

const pageErrors = new WeakMap<Page, string[]>()

export function watchErrors(page: Page) {
    const errors: string[] = []
    pageErrors.set(page, errors)
    page.on('pageerror', (error) => errors.push(error.message))
    // The session reports a listener's failure on the console and goes on.
    page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text())
    })
}

export function expectNoErrors(page: Page) {
    expect(pageErrors.get(page)).toEqual([])
}

// Exposes the session on the window, as the harness keeps it in a Svelte context.
async function exposeSession(page: Page) {
    await page.route('**/model/sessionContext.svelte.ts*', async (route) => {
        const response = await route.fetch()
        const body = await response.text()
        expect(body).toContain('return getContext();')
        await route.fulfill({
            response,
            body: body.replace(
                'return getContext();',
                'return window.mexicaSession = getContext();'
            )
        })
    })
}

export function board(page: Page) {
    return page.getByRole('group', { name: 'The island of Tenochtitlan' })
}

export async function openScenario(page: Page, name: string, { clock = false } = {}) {
    await exposeSession(page)
    if (clock) await page.clock.install()
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Scenarios' }).click()
    await page.getByText(name, { exact: true }).click()
    await expect.poll(() => page.evaluate(() => !!window.mexicaSession)).toBe(true)
    await expect(board(page)).toBeVisible()
    await settle(page)
}

export async function settle(page: Page) {
    await expect
        .poll(() => page.evaluate(() => window.mexicaSession.updatingVisibleState))
        .toBe(false)
}

export function actionCount(page: Page) {
    return page.evaluate(() => window.mexicaSession.gameState.actionCount)
}

export function undoButton(page: Page) {
    return page.getByRole('button', { name: 'UNDO', exact: true })
}

// The squares a tap would choose now, by name.
export function choices(page: Page) {
    return page.evaluate(() =>
        [...document.querySelectorAll('svg.mx-board .hit.active')].map(
            (node) => node.getAttribute('aria-label') ?? ''
        )
    )
}

// Taps a board button by keyboard, which reaches it wherever a piece stands over it.
export function press(page: Page, name: string) {
    return page.getByRole('button', { name, exact: true }).press('Enter')
}

export function pickTool(page: Page, title: string) {
    return page.locator(`.tray button[title="${title}"]`).click()
}

// Digs the first canal offered, its first square and a neighbour. The first square stays a
// choice, as tapping it again digs a single, or with no single left lets go of it.
export async function digFirstCanal(page: Page) {
    await pickTool(page, 'Canal (1 AP)')
    const [first] = await choices(page)
    await press(page, first)
    const second = (await choices(page)).find((name) => name !== first) ?? first
    await press(page, second)
    await settle(page)
}

// Walks the Pilli Mexica to the first square offered.
export async function moveToFirstChoice(page: Page) {
    const [to] = await choices(page)
    await press(page, to)
    await settle(page)
    return to
}
