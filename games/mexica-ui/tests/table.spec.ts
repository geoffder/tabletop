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
    // A walk needs no tool, so the moves are offered again.
    expect(await page.evaluate(() => window.mexicaSession.tool)).toBeUndefined()
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
    await pickTool(page, 'Canal (1 AP)')
    const starts = await choices(page)
    // Let go again: digFirstCanal picks the tool up itself.
    await pickTool(page, 'Canal (1 AP)')
    await digFirstCanal(page)
    expect(await actionCount(page)).toBe(before + 1)
    expect(await page.evaluate(() => window.mexicaSession.tool)).toBe('canal')
    await undoButton(page).click()
    await settle(page)
    expect(await actionCount(page)).toBe(before)
    // The canal tool is picked again, with the same squares to start from.
    expect(await page.evaluate(() => window.mexicaSession.tool)).toBe('canal')
    expect(await choices(page)).toEqual(starts)
    // Pressing the tool again lets go of it, back to the moves, and undoes nothing.
    await pickTool(page, 'Canal (1 AP)')
    expect(await page.evaluate(() => window.mexicaSession.tool)).toBeUndefined()
    expect(await actionCount(page)).toBe(before)
})

test('Undo of the second of two digs takes back the first at the next Undo', async ({ page }) => {
    await openScenario(page, 'Middle game')
    const before = await actionCount(page)
    await digFirstCanal(page)
    // The canal tool stays picked: dig again with it.
    const [first] = await choices(page)
    await press(page, first)
    await press(page, (await choices(page)).find((name) => name !== first) ?? first)
    await settle(page)
    expect(await actionCount(page)).toBe(before + 2)
    await undoButton(page).click()
    await settle(page)
    expect(await actionCount(page)).toBe(before + 1)
    expect(await page.evaluate(() => window.mexicaSession.tool)).toBe('canal')
    // The tool picked again is passed by: the next Undo takes back the first dig.
    await undoButton(page).click()
    await settle(page)
    expect(await actionCount(page)).toBe(before)
    expect(await page.evaluate(() => window.mexicaSession.tool)).toBe('canal')
})

test('Undo pressed while a dig is shown takes the dig back once it lands', async ({ page }) => {
    await openScenario(page, 'Middle game')
    const before = await actionCount(page)
    const canals = () => page.evaluate(() => window.mexicaSession.gameState.canals.length)
    const dug = await canals()
    await pickTool(page, 'Canal (1 AP)')
    const [first] = await choices(page)
    await press(page, first)
    await press(page, (await choices(page)).find((name) => name !== first) ?? first)
    // At once, while the dig is still being shown: it is not yet the last action.
    expect(await page.evaluate(() => window.mexicaSession.updatingVisibleState)).toBe(true)
    await undoButton(page).click()
    await expect.poll(() => actionCount(page)).toBe(before)
    await settle(page)
    expect(await actionCount(page)).toBe(before)
    expect(await canals()).toBe(dug)
    expect(await page.evaluate(() => window.mexicaSession.tool)).toBe('canal')
})

test('two quick Undos take back two digs, one each', async ({ page }) => {
    await openScenario(page, 'Middle game')
    const before = await actionCount(page)
    await digFirstCanal(page)
    const [first] = await choices(page)
    await press(page, first)
    await press(page, (await choices(page)).find((name) => name !== first) ?? first)
    await settle(page)
    expect(await actionCount(page)).toBe(before + 2)
    await undoButton(page).click()
    await undoButton(page).click()
    await expect.poll(() => actionCount(page)).toBe(before)
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
    // Undone, the temple's level is picked again.
    await undoButton(page).click()
    await settle(page)
    expect(await temples()).toBe(before)
    expect(await page.evaluate(() => window.mexicaSession.tool)).toBe(1)
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
    await undoButton(page).click()
    await settle(page)
    expect(await districts()).toBe(before)
    expect(await page.evaluate(() => window.mexicaSession.tool)).toBe('found')
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
