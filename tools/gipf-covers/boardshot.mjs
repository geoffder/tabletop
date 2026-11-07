// Screenshot a game's board alone (LYNGK's unless BOARD names another), with a transparent
// background and no labels or move marks, from the harness on PORT (default 5174).
// Usage (in the devcontainer): node boardshot.mjs OUT.png [scenario label | "new"] [width] [dpr] [click selector...]
// HIDE adds CSS selectors to hide; VH sets the viewport height; BOLT thickens LYNGK's bolts.
import { existsSync, readdirSync } from 'node:fs'

// Playwright is installed with each game UI; any one will do.
const playwright = readdirSync('/workspace/games')
    .map((name) => `/workspace/games/${name}/node_modules/@playwright/test/index.mjs`)
    .find((path) => existsSync(path))
if (!playwright) throw Error('No game UI in /workspace/games has Playwright installed')
const { chromium } = await import(playwright)

const [, , out, scenario = 'Tall stacks', width = '1400', dpr = '3', ...clicks] = process.argv
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: Number(width), height: Number(process.env.VH || 1000) }, deviceScaleFactor: Number(dpr) })
const BOARD = process.env.BOARD || '.lyngk-board'
await page.goto(`http://localhost:${process.env.PORT || 5174}/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)
if (scenario === 'new') {
    await page.locator('text=+').first().click()
    await page.locator('input[placeholder="choose a name for your game"]').fill('Cover')
    await page.locator('input[placeholder="player name"]:not([disabled])').first().fill('Bob')
    await page.locator('button:has-text("Create Game")').click()
} else {
    await page.locator("button:has-text('Scenarios')").click()
    await page.locator(`text=${scenario}`).first().click()
}
await page.waitForTimeout(2500)
for (const sel of clicks) {
    await page.locator(sel).first().click({ timeout: 8000 })
    await page.waitForTimeout(800)
}
const keepBolts = clicks.length > 0
await page.addStyleTag({
    content: `
        * { background: transparent !important; background-color: transparent !important; box-shadow: none !important; }
        ${BOARD} .coordinate-label, ${process.env.HIDE || '.none'},
        .lyngk-board .coordinate-label, .lyngk-board .marks${keepBolts ? ':not(.bolts)' : ''}${keepBolts ? '' : ', .lyngk-board .bolts'}, button { display: none !important; }
        .lyngk-board .bolt.glow { stroke-width: ${7 * Number(process.env.BOLT || 1)} !important; opacity: 0.7 !important; }
        .lyngk-board .bolt.body { stroke-width: ${3 * Number(process.env.BOLT || 1)} !important; }
        .lyngk-board .bolt.core { stroke-width: ${1.2 * Number(process.env.BOLT || 1)} !important; }
    `
})
await page.waitForTimeout(300)
if (keepBolts) await page.evaluate(() => document.querySelectorAll('.lyngk-board animate').forEach((a) => a.remove()))
await page.locator(BOARD).screenshot({ path: out, omitBackground: true })
await browser.close()
