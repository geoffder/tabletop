const ui = process.env.GAME_UI
if (!ui) throw Error('Set GAME_UI to the game UI package folder, e.g. GAME_UI=zertz-ui')
const { chromium } = await import(`/workspace/games/${ui}/node_modules/@playwright/test/index.mjs`)

// Lists what paints at a point of a harness route, topmost first, with each element's index among
// its parent's children of the same tag, its fill and the start of its path.
// Usage: [PORT=5173] GAME_UI=<slug>-ui node pick.mjs ROUTE X Y [SELECTOR]
//   X Y are CSS pixels in the page, or fractions of SELECTOR's box when it is given, e.g.
//   node pick.mjs looks 0.925 0.694 'svg[data-look="light-punct"]'
// Pre-rendered images report only the <image>: pick on the route that draws the SVG live.
const [route = '', x, y, selector] = process.argv.slice(2)
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } })
await page.goto(`http://localhost:${process.env.PORT ?? 5173}/${route}`, { waitUntil: 'networkidle' })
let point = { x: Number(x), y: Number(y) }
if (selector) {
    const element = page.locator(selector).first()
    await element.scrollIntoViewIfNeeded()
    const box = await element.boundingBox()
    point = { x: box.x + box.width * Number(x), y: box.y + box.height * Number(y) }
}
const hits = await page.evaluate(({ x, y }) =>
    document.elementsFromPoint(x, y).map((element) => {
        const parent = element.parentNode
        const same = [...(parent?.children ?? [])].filter((other) => other.tagName === element.tagName)
        const fill = element.getAttribute('fill') ?? getComputedStyle(element).fill
        const d = (element.getAttribute('d') ?? element.getAttribute('href') ?? '').slice(0, 80)
        return `${parent?.tagName}>${element.tagName}#${same.indexOf(element)} class=${element.getAttribute('class')} fill=${fill} ${d}`
    }), point)
console.log(hits.join('\n'))
await browser.close()
