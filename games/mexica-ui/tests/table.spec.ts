import { expect, test } from '@playwright/test'
import {
    actionCount,
    board,
    choices,
    digFirstCanal,
    expectNoErrors,
    moveToFirstChoice,
    openScenario,
    pickTool,
    press,
    settle,
    undoButton,
    watchErrors
} from './harness.js'

test.use({ reducedMotion: 'reduce' })

test.beforeEach(({ page }) => watchErrors(page))
test.afterEach(({ page }) => expectNoErrors(page))

test('the Pilli Mexica walks to a marked square, and Undo takes it back', async ({ page }) => {
    await openScenario(page, 'Middle game')
    expect((await choices(page)).length).toBeGreaterThan(0)
    const before = await actionCount(page)
    await moveToFirstChoice(page)
    expect(await actionCount(page)).toBe(before + 1)
    await undoButton(page).click()
    await settle(page)
    expect(await actionCount(page)).toBe(before)
})

test('a canal stages its first square; Undo and a tap off let go', async ({ page }) => {
    await openScenario(page, 'Middle game')
    const moves = await choices(page)
    await pickTool(page, 'Canal (1 AP)')
    const starts = await choices(page)
    expect(starts).not.toEqual(moves)

    await press(page, starts[0])
    expect(await page.evaluate(() => window.mexicaSession.chosenCell)).toBeDefined()
    expect((await choices(page)).length).toBeLessThan(starts.length)

    await undoButton(page).click()
    expect(await page.evaluate(() => window.mexicaSession.chosenCell)).toBeUndefined()
    expect(await page.evaluate(() => window.mexicaSession.tool)).toBe('canal')

    await board(page).click({ position: { x: 4, y: 4 } })
    expect(await page.evaluate(() => window.mexicaSession.tool)).toBeUndefined()
    expect(await choices(page)).toEqual(moves)
})

test('a dug canal keeps the canal tool picked, and Undo takes back the dig', async ({ page }) => {
    await openScenario(page, 'Middle game')
    const before = await actionCount(page)
    await digFirstCanal(page)
    expect(await actionCount(page)).toBe(before + 1)
    expect(await page.evaluate(() => window.mexicaSession.tool)).toBe('canal')
    await undoButton(page).click()
    await settle(page)
    expect(await actionCount(page)).toBe(before)
})

test('a temple goes on a marked square', async ({ page }) => {
    await openScenario(page, 'Ruled out')
    const temples = () => page.evaluate(() => window.mexicaSession.gameState.temples.length)
    const before = await temples()
    await pickTool(page, '1-level temple (1 AP)')
    const [square] = await choices(page)
    await press(page, square)
    await settle(page)
    expect(await temples()).toBe(before + 1)
})

test('the ringed token on the display founds the district', async ({ page }) => {
    await openScenario(page, 'Founding')
    const districts = () => page.evaluate(() => window.mexicaSession.gameState.districts.length)
    const before = await districts()
    await press(page, 'Found the district with this token')
    expect(await page.evaluate(() => window.mexicaSession.tool)).toBe('found')
    await press(page, 'D3')
    await settle(page)
    expect(await districts()).toBe(before + 1)
})

test('End turn passes the turn on', async ({ page }) => {
    await openScenario(page, 'Middle game')
    const mover = await page.evaluate(() => window.mexicaSession.gameState.activePlayerIds[0])
    await page.getByRole('button', { name: 'End turn', exact: true }).click()
    await settle(page)
    expect(await page.evaluate(() => window.mexicaSession.gameState.activePlayerIds[0])).not.toBe(
        mover
    )
})
