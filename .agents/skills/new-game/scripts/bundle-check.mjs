// Checks a game's published UI bundle as the site would load it (see references/browser-checks.md,
// "The published bundle"). Run in the container after `pnpm run bundle` in the UI package:
//   GAME_UI=<slug>-ui node .agents/skills/new-game/scripts/bundle-check.mjs
// Fails on Vite-only code left in the bundle, asset URLs with no file in bundle/assets, or an
// error importing index.js and calling UiDefinition.runtime(), which loads every component.
import { readFile, readdir } from 'node:fs/promises'
import { join, extname, basename } from 'node:path'

const ui = process.env.GAME_UI
if (!ui) throw Error('Set GAME_UI to the game UI package folder, e.g. GAME_UI=matrx-ui')
const game = ui.replace(/-ui$/, '')
const root = `/workspace/games/${ui}`
const dir = join(root, 'bundle')
const pw = await import(`${root}/node_modules/@playwright/test/index.mjs`)
const problems = []

const code = (await readdir(dir)).filter((name) => /\.(js|css)$/.test(name))
const assets = new Set(await readdir(join(dir, 'assets')).catch(() => []))
const assetRef = new RegExp(`/games/${game}/ui/[^/"'\`) ]+/assets/[^"'\`) ]+`, 'g')
let refs = 0
for (const name of code) {
    const text = await readFile(join(dir, name), 'utf8')
    for (const left of new Set(text.match(/import\.meta\.\w+|\$app\/[\w/]+|\$lib\/[^"']+/g))) {
        problems.push(`${name} still contains ${left}`)
    }
    for (const url of new Set(text.match(assetRef))) {
        refs++
        if (!assets.has(basename(url))) problems.push(`${name} refers to ${url}, not in bundle/assets`)
    }
}

const TYPES = { '.js': 'text/javascript', '.css': 'text/css', '.map': 'application/json' }
const browser = await pw.chromium.launch()
const page = await browser.newPage()
page.on('pageerror', (error) => problems.push(`page error: ${error.message}`))
await page.route('http://bundle.test/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/games\/[^/]+\/ui\/[^/]+\//, '/')
    if (path === '/') return route.fulfill({ body: '<!doctype html><body></body>', contentType: 'text/html' })
    try {
        const body = await readFile(join(dir, path))
        await route.fulfill({ body, contentType: TYPES[extname(path)] ?? 'application/octet-stream' })
    } catch {
        problems.push(`page asked for ${path}, not in the bundle`)
        await route.fulfill({ status: 404 })
    }
})
await page.goto('http://bundle.test/')
const loaded = await page.evaluate(async () => {
    try {
        const { UiDefinition } = await import('http://bundle.test/index.js')
        const runtime = await UiDefinition.runtime()
        return { thumbnail: UiDefinition.info.thumbnailUrl, runtime: Object.keys(runtime ?? {}) }
    } catch (error) {
        return { error: String(error) }
    }
})
await browser.close()
if (loaded.error) problems.push(`loading the runtime threw ${loaded.error}`)

console.log(`${ui}: ${code.length} code files, ${assets.size} assets, ${refs} asset URLs`)
if (!loaded.error) console.log(`runtime: ${loaded.runtime.join(', ')}\nthumbnail: ${loaded.thumbnail}`)
for (const problem of problems) console.log(`PROBLEM ${problem}`)
console.log(problems.length ? 'bundle check FAILED' : 'bundle check passed')
process.exit(problems.length ? 1 : 0)
