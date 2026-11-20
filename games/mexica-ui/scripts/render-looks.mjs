// Saves the looks the /looks page paints (board/surfaceTexture.ts) as the images in
// ../src/lib/images/looks the board shows: drawing
// them as a game opens would take seconds. It also writes board/lookUrls.ts, importing each file
// by name, and board/lookOutlines.ts, the outline of each figure the board fills with its owner's
// colour. Rerun after changing any look, with the harness running:
//   pnpm run render-looks   (PORT defaults to 5217)
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const LIB = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'lib')
const OUT = join(LIB, 'images', 'looks')
const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto(`http://localhost:${process.env.PORT ?? 5217}/looks`, { waitUntil: 'networkidle' })
const section = page.locator('[data-looks]')
const drawn = await section.getAttribute('data-looks', { timeout: 180_000 })
const traced = await section.getAttribute('data-outlines')
await browser.close()

const looks = Object.entries(JSON.parse(drawn)).toSorted(([a], [b]) => a.localeCompare(b))
mkdirSync(OUT, { recursive: true })
for (const old of readdirSync(OUT)) rmSync(join(OUT, old))
for (const [name, data] of looks) {
    const bytes = Buffer.from(data.split(',')[1], 'base64')
    writeFileSync(join(OUT, `${name}.webp`), bytes)
    console.log(name, bytes.length)
}

// Each file imported on its own: Vite and the published bundle's rollup both turn such an import
// into the file's URL, where a glob is Vite's alone and fails in the bundle.
const variable = (name) => name.replace(/-(\w)/g, (_, letter) => letter.toUpperCase())
writeFileSync(
    join(LIB, 'board', 'lookUrls.ts'),
    [
        '// Written by scripts/render-looks.mjs: the file of every look, by name.',
        ...looks.map(([name]) => `import ${variable(name)} from '../images/looks/${name}.webp'`),
        '',
        'export const LOOK_URLS: Record<string, string> = {',
        ...looks.map(
            ([name], index) =>
                `    '${name}': ${variable(name)}${index < looks.length - 1 ? ',' : ''}`
        ),
        '}',
        ''
    ].join('\n')
)

const outlines = Object.entries(JSON.parse(traced)).toSorted(([a], [b]) => a.localeCompare(b))
writeFileSync(
    join(LIB, 'board', 'lookOutlines.ts'),
    [
        "// Written by scripts/render-looks.mjs: each figure's outline, by the name of its look.",
        'export const LOOK_OUTLINES: Record<string, string> = {',
        ...outlines.map(
            ([name, path], index) =>
                `    '${name}': '${path}'${index < outlines.length - 1 ? ',' : ''}`
        ),
        '}',
        ''
    ].join('\n')
)
