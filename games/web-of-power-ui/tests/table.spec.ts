import { expect, test, type Page } from '@playwright/test'
import {
    actionCount,
    chooseCard,
    deck,
    expectNoErrors,
    hand,
    market,
    openScenario,
    placeFirst,
    SCORING,
    settle,
    targets,
    undoButton,
    viewAs,
    watchErrors
} from './harness.js'

test.use({ reducedMotion: 'reduce' })
test.beforeEach(({ page }) => watchErrors(page))
test.afterEach(({ page }) => expectNoErrors(page))

const prompt = (page: Page) => page.locator('.action-card .panel').first()
const chosen = (page: Page) => page.locator('[aria-label="Your hand"] button[aria-pressed="true"]')
const litCountries = (page: Page) => page.locator('svg.wop-board .lit')

// From the top of the action card: the harness's own turn bar above it changes as a game ends.
async function boardTop(page: Page) {
    const board = await page.getByRole('group', { name: 'Map of Europe' }).boundingBox()
    const card = await page.locator('.action-card').first().boundingBox()
    expect(board).not.toBeNull()
    expect(card).not.toBeNull()
    return (board?.y ?? 0) - (card?.y ?? 0)
}

test('choosing a card lights its countries, and Undo or a tap off lets go', async ({ page }) => {
    await openScenario(page, 'Late game')
    await chooseCard(page)
    await expect(chosen(page)).toHaveCount(1)
    await expect(litCountries(page).first()).toBeVisible()
    expect(await targets(page).count()).toBeGreaterThan(0)

    await undoButton(page).click()
    await settle(page)
    await expect(chosen(page)).toHaveCount(0)
    await expect(targets(page)).toHaveCount(0)

    await chooseCard(page)
    await page.getByRole('group', { name: 'Map of Europe' }).click({ position: { x: 5, y: 5 } })
    await settle(page)
    await expect(chosen(page)).toHaveCount(0)
})

test('a pair of one colour is a joker, placing in any country', async ({ page }) => {
    await openScenario(page, 'Late game')
    const cards = await page.evaluate(() => window.wopSession.hand)
    const colour = cards.find((card, index) => cards.indexOf(card) !== index)
    expect(colour).toBeDefined()
    const indices = cards.flatMap((card, index) => (card === colour ? [index] : []))
    await hand(page).nth(indices[0]).click()
    await hand(page).nth(indices[1]).click()
    await settle(page)
    await expect(chosen(page)).toHaveCount(2)
    expect(await page.evaluate(() => window.wopSession.chosenCountries.length)).toBe(9)

    await undoButton(page).click()
    await settle(page)
    await expect(chosen(page)).toHaveCount(1)
})

test('placing a piece spends the card, and Undo takes it back', async ({ page }) => {
    await openScenario(page, 'Late game')
    const before = await actionCount(page)
    const handBefore = await hand(page).count()
    await chooseCard(page)
    await placeFirst(page)
    expect(await actionCount(page)).toBe(before + 1)
    await expect(hand(page)).toHaveCount(handBefore - 1)
    await expect(prompt(page)).toContainText(/second piece|Draw/)

    await undoButton(page).click()
    await settle(page)
    expect(await actionCount(page)).toBe(before)
    await expect(hand(page)).toHaveCount(handBefore)
})

test('drawing from the market and the deck fills the hand', async ({ page }) => {
    await openScenario(page, 'Late game')
    await chooseCard(page)
    await placeFirst(page)
    await chooseCard(page)
    await placeFirst(page)
    await expect(prompt(page)).toHaveText('Draw 2: from market or deck')
    await market(page).first().click()
    await settle(page)
    await deck(page).click()
    await settle(page)
    expect(await page.evaluate(() => window.wopSession.activePlayers[0]?.name)).toBe('Bob')
    await viewAs(page, 'Alice')
    await expect(hand(page)).toHaveCount(3)
})

test('exchanging a card discards it and draws one', async ({ page }) => {
    await openScenario(page, 'Late game')
    await chooseCard(page)
    const discard = await page.evaluate(() => window.wopSession.gameState.discard.length)
    await page.getByRole('button', { name: 'Exchange', exact: true }).click()
    await settle(page)
    expect(await page.evaluate(() => window.wopSession.gameState.discard.length)).toBe(discard + 1)
    await expect(prompt(page)).toContainText('Draw 1')
})

test('the discard view counts each colour', async ({ page }) => {
    await openScenario(page, 'Late game')
    await page.getByRole('button', { name: /^Discard pile, / }).click()
    const view = page.locator('.discard-view')
    await expect(view).toBeVisible()
    const discard = await page.evaluate(() => window.wopSession.gameState.discard.length)
    await expect(view).toContainText(`Discard pile · ${discard}`)
    await page.getByRole('group', { name: 'Map of Europe' }).click({ position: { x: 5, y: 5 } })
    await expect(view).toBeHidden()
})

test('a waiting player sees the last move, and no choices', async ({ page }) => {
    await openScenario(page, 'Late game')
    await chooseCard(page)
    await placeFirst(page)
    await viewAs(page, 'Bob')
    await expect(prompt(page)).toContainText(/^Alice placed (a cloister|an advisor)/)
    await expect(page.locator('[aria-label="Your hand"] button.card.choosable')).toHaveCount(0)
    await expect(targets(page)).toHaveCount(0)
})

test('the interim scoring names its points and the game carries on', async ({ page }) => {
    await openScenario(page, 'Interim scoring')
    await chooseCard(page)
    await placeFirst(page)
    if (await page.getByRole('button', { name: 'Done', exact: true }).isVisible()) {
        await page.getByRole('button', { name: 'Done', exact: true }).click()
        await settle(page)
    }
    await deck(page).click()
    await settle(page, SCORING)
    expect(await page.evaluate(() => window.wopSession.gameState.deckExhaustions)).toBe(1)
    await viewAs(page, 'Alice')
    await expect(prompt(page)).toContainText('Interim scoring:')
})

test('the game ends inside the panel, without moving the board', async ({ page }) => {
    for (const size of [
        { width: 1280, height: 900 },
        { width: 390, height: 844 }
    ]) {
        await page.setViewportSize(size)
        await openScenario(page, 'Final round')
        const top = await boardTop(page)
        await page.getByRole('button', { name: 'Pass', exact: true }).click()
        await settle(page, SCORING)
        await expect(prompt(page)).toContainText(/wins|share the win/)
        expect(await boardTop(page)).toBe(top)
    }
})
