import { mkdirSync, readFileSync, renameSync } from 'node:fs'

// Records one variant of a motion in real time, with the game's source rewritten as Vite serves it,
// so timings can be compared on video before any of them is written into the code.
// Usage (in the container, as the node user):
//   [PORT=5173] [ROOT=/workspace] [W=1440] [H=900] [TAIL=2000] [REWRITES=file.json]
//   GAME_UI=<slug>-ui OUT=<dir> node motion-variant.mjs step... -- step...
// Steps before `--` set up the position; the steps after it are the action recorded. The video
// ends TAIL ms after them, so cut it from its end (motion-grid.sh does).
// Steps: scenario:<menu name>, click:<selector>, press:<selector> (Enter on it), wait:<ms>,
// eval:<js>.
// REWRITES is a JSON list of { "module": "<url glob>", "from": "<text>", "to": "<text>" }. Match
// the text as Vite serves it (`curl http://localhost:<port>/src/lib/…ts`): numbers lose their
// leading zero, strings take double quotes, lines end in `;`. A `from` that is not found throws.
const ui = process.env.GAME_UI
const out = process.env.OUT
if (!ui || !out) throw Error('Set GAME_UI (e.g. zertz-ui) and OUT (a folder for raw.webm)')
const root = process.env.ROOT ?? '/workspace'
const { chromium } = await import(`${root}/games/${ui}/node_modules/@playwright/test/index.mjs`)

const args = process.argv.slice(2)
const split = args.indexOf('--')
if (split < 0) throw Error('Put `--` before the steps of the action to record')
const rewrites = process.env.REWRITES ? JSON.parse(readFileSync(process.env.REWRITES, 'utf8')) : []
const size = { width: Number(process.env.W ?? 1440), height: Number(process.env.H ?? 900) }

mkdirSync(out, { recursive: true })
const browser = await chromium.launch()
const context = await browser.newContext({ viewport: size, recordVideo: { dir: out, size } })
const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
for (const [module, edits] of Object.entries(Object.groupBy(rewrites, (edit) => edit.module))) {
    await page.route(module, async (route) => {
        const response = await route.fetch()
        let body = await response.text()
        for (const { from, to } of edits) {
            if (!body.includes(from)) throw Error(`Not served as written: ${from}`)
            body = body.replaceAll(from, to)
        }
        await route.fulfill({ response, body })
    })
}
await page.goto(`http://localhost:${process.env.PORT ?? 5173}/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)

const run = async (step) => {
    const [kind, ...rest] = step.split(':')
    const arg = rest.join(':')
    if (kind === 'scenario') {
        await page.locator('button:has-text("Scenarios")').first().click()
        await page.locator(`text="${arg}"`).first().click()
        await page.waitForTimeout(2500)
    } else if (kind === 'click') await page.locator(arg).first().click()
    else if (kind === 'press') await page.locator(arg).first().press('Enter')
    else if (kind === 'wait') await page.waitForTimeout(Number(arg))
    else if (kind === 'eval') console.log(await page.evaluate(arg))
    else throw Error(`Unknown step ${step}`)
}
for (const step of args.slice(0, split)) await run(step)
// Still frames before the action, so every variant starts from rest.
await page.waitForTimeout(800)
for (const step of args.slice(split + 1)) await run(step)
await page.waitForTimeout(Number(process.env.TAIL ?? 2000))
const video = page.video()
await context.close()
renameSync(await video.path(), `${out}/raw.webm`)
await browser.close()
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : `${out}/raw.webm`)
