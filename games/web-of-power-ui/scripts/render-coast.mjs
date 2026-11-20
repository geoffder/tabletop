// Renders the coasts as the board prints them into ../src/lib/images/coast.webp: a pale rim along
// the land's edge and a lighter glow in the water off the shore. Both are blurs of the coastline
// (src/lib/board/mapData.ts), so they are drawn once here rather than as a game opens; the image
// lies over the countries, under the borders and roads. Rerun after changing the coastline:
// pnpm run render-coast
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = process.env.OUT ?? join(ROOT, 'src', 'lib', 'images', 'coast.webp')
// How strongly the rim and glow show, 1 as chosen.
const STRENGTH = Number(process.env.STRENGTH ?? 1)
// Pixels per map unit. Both effects are soft, so the map's own size is enough even zoomed in.
const SCALE = 1

const mapData = await readFile(join(ROOT, 'src', 'lib', 'board', 'mapData.ts'), 'utf8')
const view = mapData.match(/MAP_VIEW = \{ x: (\d+), y: (\d+), width: (\d+), height: (\d+) \}/)
const [x, y, width, height] = view.slice(1).map(Number)
const land = mapData.match(/LAND_PATH =\s*'([^']+)'/)[1]

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width * SCALE}" height="${height * SCALE}"
    viewBox="${x} ${y} ${width} ${height}">
    <defs>
        <filter id="glow" filterUnits="userSpaceOnUse" x="${x}" y="${y}" width="${width}" height="${height}">
            <feGaussianBlur in="SourceGraphic" stdDeviation="13" result="soft"/>
            <feComposite in="soft" in2="SourceGraphic" operator="out"/>
        </filter>
        <filter id="rim" filterUnits="userSpaceOnUse" x="${x}" y="${y}" width="${width}" height="${height}">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4.5"/>
        </filter>
        <clipPath id="land"><path d="${land}"/></clipPath>
    </defs>
    <path d="${land}" fill="#eaf8f2" filter="url(#glow)" opacity="${Math.min(1, 0.85 * STRENGTH)}"/>
    <g clip-path="url(#land)">
        <path d="M${x - 50} ${y - 50}h${width + 100}v${height + 100}h${-width - 100}Z ${land}"
            fill-rule="evenodd" fill="#fff6d6" filter="url(#rim)" opacity="${Math.min(1, 0.7 * STRENGTH)}"/>
    </g>
</svg>`

const browser = await chromium.launch()
try {
    const page = await browser.newPage({
        viewport: { width: width * SCALE, height: height * SCALE }
    })
    await page.setContent(`<!doctype html><body style="margin:0">${svg}</body>`)
    const png = await page.screenshot({ omitBackground: true })
    const webp = await page.evaluate(async (data) => {
        const image = new Image()
        image.src = `data:image/png;base64,${data}`
        await image.decode()
        const canvas = document.createElement('canvas')
        canvas.width = image.width
        canvas.height = image.height
        canvas.getContext('2d').drawImage(image, 0, 0)
        return canvas.toDataURL('image/webp', 0.85).split(',')[1]
    }, png.toString('base64'))
    await writeFile(OUT, Buffer.from(webp, 'base64'))
    console.log(`wrote ${OUT} (${Math.round((webp.length * 3) / 4 / 1024)} KB)`)
} finally {
    await browser.close()
}
