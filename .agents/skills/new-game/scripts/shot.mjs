import { mkdirSync } from 'node:fs'

const ui = process.env.GAME_UI
if (!ui) throw Error('Set GAME_UI to the game UI package folder, e.g. GAME_UI=zertz-ui')
const { chromium } = await import(`/workspace/games/${ui}/node_modules/@playwright/test/index.mjs`)

// Usage: [PORT=5173] [P=path] [Q=?query] [DPR=1] GAME_UI=<slug>-ui node shot.mjs WIDTH HEIGHT step...
// (see references/browser-checks.md)
// Steps: new, click, tap, hover, fill, wait, eval, reload, shot.
const [, , width = '1400', height = '900', ...steps] = process.argv
const browser = await chromium.launch()
const context = await browser.newContext({
    viewport: { width: Number(width), height: Number(height) },
    deviceScaleFactor: Number(process.env.DPR ?? 1)
})
const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
mkdirSync('/workspace/tmp/screens', { recursive: true })
await page.goto(`http://localhost:${process.env.PORT ?? 5173}/${process.env.P ?? ''}${process.env.Q ?? ''}`, {
    waitUntil: 'networkidle'
})
await page.waitForTimeout(1200)
for (const step of steps) {
    const [kind, ...rest] = step.split(':')
    const arg = rest.join(':')
    if (kind === 'new') {
        await page.locator('text=+').first().click()
        await page.locator('input[placeholder="choose a name for your game"]').fill('Test')
        await page.locator('input[placeholder="player name"]:not([disabled])').first().fill('Bob')
        if (arg) await page.locator('select').first().selectOption({ label: arg })
        await page.locator('button:has-text("Create Game")').click()
        await page.waitForTimeout(1500)
    } else if (kind === 'shot') await page.screenshot({ path: `/workspace/tmp/screens/${arg}.png` })
    else if (kind === 'click') await page.locator(arg).first().click({ timeout: 8000 })
    else if (kind === 'tap') await page.locator(arg).first().click({ timeout: 8000 })
    else if (kind === 'reload') { await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(Number(arg || 0)) }
    else if (kind === 'hover') await page.locator(arg).first().hover()
    else if (kind === 'wait') await page.waitForTimeout(Number(arg))
    else if (kind === 'fill') {
        const [sel, value] = arg.split('=>')
        await page.locator(sel).first().fill(value)
    } else if (kind === 'eval') console.log(await page.evaluate(arg))
    if (kind === 'click') await page.waitForTimeout(600)
}
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no errors')
await browser.close()
