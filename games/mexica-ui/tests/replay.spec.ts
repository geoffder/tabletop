import { expect, test, type Page } from '@playwright/test'
import { expectNoErrors, openScenario, settle, watchErrors } from './harness.js'

// A history replay of several actions plays each against the board its step starts from, not the
// one shown before the replay: a canoe ride through a canal dug earlier in the same replay
// follows that canal, as it did when played.

declare global {
    interface Window {
        canoe: { trace: number[][]; sampling: boolean }
    }
}

test.beforeEach(({ page }) => watchErrors(page))
test.afterEach(({ page }) => expectNoErrors(page))

// Where the canoe is drawn, each frame it moves, while `run` plays.
async function canoeCourse(page: Page, run: () => Promise<unknown>): Promise<number[][]> {
    await page.evaluate(() => {
        window.canoe = { trace: [], sampling: true }
        const sample = () => {
            const transform = document
                .querySelector('svg.mx-board g.surface.canoe')
                ?.getAttribute('transform')
            const at = transform?.match(/translate\(([-\d.e]+) ([-\d.e]+)\)/)
            if (at) window.canoe.trace.push([Number(at[1]), Number(at[2])])
            if (window.canoe.sampling) requestAnimationFrame(sample)
        }
        requestAnimationFrame(sample)
    })
    await run()
    await settle(page)
    return page.evaluate(() => {
        window.canoe.sampling = false
        return window.canoe.trace
    })
}

const bounds = (course: number[][]) => ({
    minX: Math.min(...course.map(([x]) => x)),
    maxX: Math.max(...course.map(([x]) => x)),
    minY: Math.min(...course.map(([, y]) => y)),
    maxY: Math.max(...course.map(([, y]) => y))
})

test('a replayed dig and canoe ride follow the new canal, as played', async ({ page }) => {
    await openScenario(page, 'Canal rides')
    // A canal on M5 and M6 opens a ride by canoe from the bridge on Q8 straight to the one on N7.
    await page.evaluate(() => window.mexicaSession.digCanal([96, 117]))
    await settle(page)
    await page.evaluate(() => window.mexicaSession.letGo())
    const first = await page.evaluate(() => window.mexicaSession.gameState.actionCount - 1)
    const played = await canoeCourse(page, () =>
        page.evaluate(() => window.mexicaSession.chooseCell(139))
    )
    const last = await page.evaluate(() => window.mexicaSession.gameState.actionCount - 1)
    expect(last).toBe(first + 1)

    const replayed = await canoeCourse(page, () =>
        page.evaluate(
            ([from, to]) => window.mexicaSession.history.replayRange(from, to),
            [first, last]
        )
    )
    expect(played.length).toBeGreaterThan(20)
    expect(replayed.length).toBeGreaterThan(20)
    // A canoe that missed the new canal crosses the land in a straight line, more than a square
    // (40) clear of it. Half a square allows for the frames a busy machine drops while sampling.
    const want = bounds(played)
    const got = bounds(replayed)
    for (const side of ['minX', 'maxX', 'minY', 'maxY'] as const) {
        expect(Math.abs(got[side] - want[side])).toBeLessThan(20)
    }
})
