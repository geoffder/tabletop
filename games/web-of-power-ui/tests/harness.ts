import { expect, type Page } from '@playwright/test'
import type { WebOfPowerGameSession } from '../src/lib/model/session.svelte.js'

declare global {
    interface Window {
        wopSession: WebOfPowerGameSession
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

// The harness keeps the session in a Svelte context, out of the page's reach.
async function exposeSession(page: Page) {
    await page.route('**/model/sessionContext.svelte.ts*', async (route) => {
        const response = await route.fetch()
        const body = await response.text()
        expect(body).toContain('return getContext();')
        await route.fulfill({
            response,
            body: body.replace('return getContext();', 'return window.wopSession = getContext();')
        })
    })
}

async function ready(page: Page) {
    await expect.poll(() => page.evaluate(() => !!window.wopSession)).toBe(true)
    await expect(page.getByRole('group', { name: 'Map of Europe' })).toBeVisible()
    await settle(page)
}

export async function openScenario(page: Page, name: string, { clock = false } = {}) {
    await exposeSession(page)
    if (clock) await page.clock.install()
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Scenarios' }).click()
    await page.getByText(name, { exact: true }).click()
    await ready(page)
}

// A scoring plays its entries one after another, so it is given longer.
export async function settle(page: Page, { timeout = 5_000 } = {}) {
    await expect
        .poll(() => page.evaluate(() => window.wopSession.updatingVisibleState), { timeout })
        .toBe(false)
}

export const SCORING = { timeout: 40_000 }

export function actionCount(page: Page) {
    return page.evaluate(() => window.wopSession.gameState.actionCount)
}

export function undoButton(page: Page) {
    return page.getByRole('button', { name: 'UNDO', exact: true })
}

// The hand's cards, the market's and the deck, as the tray shows them.
export const hand = (page: Page) => page.locator('[aria-label="Your hand"] .card')
export const market = (page: Page) => page.locator('[aria-label="Market"] .card')
export const deck = (page: Page) => page.getByRole('button', { name: /^Deck, / })

// Every target on the board, cloister spaces and seals alike.
export const targets = (page: Page) =>
    page.locator('[aria-label^="found a cloister"], [aria-label^="send an advisor"]')

// Taps a board button by keyboard, which reaches it wherever a house stands over it.
export function press(page: Page, name: string) {
    return page.getByRole('button', { name, exact: true }).press('Enter')
}

// Chooses the hand's first card that can pay for a piece now.
export async function chooseCard(page: Page) {
    await page.locator('[aria-label="Your hand"] button.card.choosable').first().click()
    await settle(page)
}

// Places a piece on the first target offered.
export async function placeFirst(page: Page) {
    const name = await targets(page).first().getAttribute('aria-label')
    expect(name).not.toBeNull()
    await press(page, name ?? '')
    await settle(page)
}

// Shows the table as a player sees it, through the harness's protected view.
export async function viewAs(page: Page, name: string) {
    if (!(await page.locator('select').first().isVisible())) {
        await page.getByRole('button', { name: 'Options' }).click()
        await page.getByText('Protected mode', { exact: true }).click()
        await page.keyboard.press('Escape')
        await settle(page)
    }
    await page.locator('select').first().selectOption({ label: name })
    await settle(page)
}
