// Mexica showcase: screenshots and real-time GIFs from the dev harness.
// In the container: node /workspace/tmp/mexica/showcase/capture.mjs [job...]
// Then on the host: .agents/skills/game-showcase/scripts/encode.sh tmp/mexica/showcase
import { showcase } from '/workspace/tmp/gbs-wt/.agents/skills/game-showcase/scripts/showcase.mjs'

const sc = await showcase({
    ui: '/workspace/tmp/mexica-wt/games/mexica-ui',
    base: process.env.BASE ?? 'http://localhost:5218',
    out: '/workspace/tmp/mexica/showcase',
    global: 'mexicaSession',
    board: 'svg.mx-board'
})
const { open, settle, press, choices, shot, gif } = sc
const GIF_VIEW = { width: 2400, height: 1500, dpr: 1 }
const pickTool = (page, title) => page.locator(`.tray button[title="${title}"]`).click()

// The box round the named squares (two corners will do). Only some squares have a button, and the
// tilted board draws them wider than tall, so the grid is read from the buttons there are. Room
// above for tall pieces; never above the water's top edge.
async function squares(page, names, pad = 0.6) {
    const grid = await page.evaluate(() => {
        const cols = {}
        const rows = {}
        let width = 0
        let height = 0
        for (const node of document.querySelectorAll('svg.mx-board [aria-label]')) {
            const match = node.getAttribute('aria-label').match(/^([A-U])(\d+)$/)
            if (!match) continue
            const box = node.getBoundingClientRect()
            cols[match[1]] = box.x
            rows[match[2]] = box.y
            width = box.width
            height = box.height
        }
        return { cols, rows, width, height }
    })
    const [col] = Object.keys(grid.cols)
    const [row] = Object.keys(grid.rows)
    const at = (name) => ({
        x: grid.cols[col] + (name.charCodeAt(0) - col.charCodeAt(0)) * grid.width,
        y: grid.rows[row] + (Number(name.slice(1)) - Number(row)) * grid.height,
        width: grid.width,
        height: grid.height
    })
    const board = await page.locator('svg.mx-board').boundingBox()
    const water = at('A1').y - 0.6 * grid.height
    return sc.around(page, names.map(at), {
        pad: pad * grid.width,
        top: (pad + 1.2) * grid.height,
        within: { ...board, y: water, height: board.y + board.height - water }
    })
}

await sc.run({
    // ---------- Screenshots ----------
    async table() {
        const page = await sc.page()
        await open(page, 'Middle game')
        await shot(page, '01-table-middle-game')
        await shot(page, '02-board-middle-game', sc.board(page))
        return page
    },
    async late() {
        const page = await sc.page()
        await open(page, 'Late game')
        await shot(page, '03-table-late-game')
        await shot(page, '04-board-late-game', sc.board(page))
        return page
    },
    async moves() {
        const page = await sc.page()
        await open(page, 'Canal rides')
        await shot(page, '05-move-choices')
        const hit = await page.getByRole('button', { name: 'O8', exact: true }).boundingBox()
        await page.mouse.move(hit.x + hit.width / 2, hit.y + hit.height / 2)
        await page.waitForTimeout(400)
        await shot(page, '06-move-hover', sc.board(page))
        return page
    },
    async canalTool() {
        const page = await sc.page()
        await open(page, 'Canal rides')
        await pickTool(page, 'Canal (1 AP)')
        await page.waitForTimeout(400)
        await press(page, 'M5')
        await page.waitForTimeout(400)
        await shot(page, '07-canal-tool')
        return page
    },
    async founding() {
        const page = await sc.page()
        await open(page, 'Founding')
        await page.getByRole('button', { name: 'Found', exact: true }).click()
        await page.waitForTimeout(500)
        await shot(page, '08-founding-choices')
        await press(page, 'D3')
        await settle(page)
        await page.waitForTimeout(400)
        await shot(page, '09-founded')
        return page
    },
    async scoring() {
        const page = await sc.page()
        await open(page, 'First scoring')
        await page.getByRole('button', { name: 'End turn' }).click()
        await page.waitForTimeout(Number(process.env.SCORE_AT ?? 1600))
        await shot(page, '10-period-scoring')
        return page
    },
    async final() {
        const page = await sc.page()
        await open(page, 'Final scoring')
        await page.getByRole('button', { name: 'End turn' }).click()
        await settle(page)
        await page.waitForTimeout(800)
        await shot(page, '11-final-scores')
        return page
    },
    async phone() {
        const page = await sc.page({ width: 390, height: 844, dpr: 3 })
        await open(page, 'Middle game')
        await shot(page, '12-phone')
        return page
    },

    // ---------- Real-time GIFs ----------
    async gifDig() {
        const page = await sc.page(GIF_VIEW)
        await open(page, 'Canal rides')
        await gif(page, 'canal-dig', await squares(page, ['K3', 'R10']), async () => {
            await pickTool(page, 'Canal (1 AP)')
            await page.waitForTimeout(500)
            await press(page, 'M5')
            await page.waitForTimeout(600)
            await press(page, 'M6')
        })
        return page
    },
    async gifDigRide() {
        const page = await sc.page(GIF_VIEW)
        await open(page, 'Canal rides')
        await gif(page, 'canal-dig-then-canoe', await squares(page, ['K3', 'S10']), async () => {
            await pickTool(page, 'Canal (1 AP)')
            await page.waitForTimeout(500)
            await press(page, 'M5')
            await page.waitForTimeout(600)
            await press(page, 'M6')
            await settle(page)
            await page.evaluate(() => window.mexicaSession.letGo())
            await page.waitForTimeout(900)
            await press(page, 'N7')
        })
        return page
    },
    async gifRide() {
        const page = await sc.page(GIF_VIEW)
        await open(page, 'Canal rides')
        await gif(page, 'canoe-ride', await squares(page, ['M3', 'T10']), () => press(page, 'O6'))
        return page
    },
    async gifRound() {
        const page = await sc.page(GIF_VIEW)
        await open(page, 'Canal rides')
        await gif(page, 'canoe-round-the-island', await squares(page, ['A1', 'U14'], 0.9), () =>
            press(page, 'H13')
        )
        return page
    },
    async gifJumpOver() {
        const page = await sc.page(GIF_VIEW)
        await open(page, 'Jump over')
        await gif(page, 'canoe-jump-over', await squares(page, ['M4', 'T11']), () => press(page, 'R8'))
        return page
    },
    // Bob steps off the bridge at Q8 into the 6-square district at P8, picks a 2-level temple
    // (the district lights up), and builds it.
    async gifTemple() {
        const page = await sc.page(GIF_VIEW)
        await open(page, 'Canal rides')
        await gif(
            page,
            'temple-step-off-and-build',
            await squares(page, ['L4', 'S11']),
            async () => {
                await press(page, 'P8')
                await settle(page)
                await page.waitForTimeout(700)
                await pickTool(page, '2-level temple (2 AP)')
                await page.waitForTimeout(1400)
                await press(page, process.env.SPOT ?? 'P6')
            },
            { lead: 900 }
        )
        return page
    },
    // Carol walks to K10, a canal on K9 and L9 cuts a 9-square district off the mainland, and she
    // founds it with the 9 from the display.
    async gifSealFound() {
        const page = await sc.page(GIF_VIEW)
        await open(page, 'Middle game')
        await press(page, 'K10')
        await settle(page)
        await page.waitForTimeout(500)
        await gif(
            page,
            'canal-seals-district-then-found',
            await squares(page, ['H3', 'U13'], 0.4),
            async () => {
                await pickTool(page, 'Canal (1 AP)')
                await page.waitForTimeout(700)
                await press(page, 'K9')
                await page.waitForTimeout(700)
                await press(page, 'L9')
                await settle(page)
                await page.evaluate(() => window.mexicaSession.letGo())
                await page.waitForTimeout(900)
                await page.getByRole('button', { name: 'Found', exact: true }).click()
                await page.waitForTimeout(1400)
                const spots = await choices(page)
                await press(page, process.env.FOUND_AT ?? spots.find((n) => n !== 'K10') ?? spots[0])
            },
            { tail: 1500 }
        )
        return page
    },
    async gifRuledOut() {
        const page = await sc.page(GIF_VIEW)
        await open(page, 'Ruled out')
        await gif(
            page,
            'temple-rules-out-tokens',
            await squares(page, ['C1', 'U8'], 0.6),
            async () => {
                await pickTool(page, '3-level temple (3 AP)')
                await page.waitForTimeout(900)
                await press(page, 'F1')
            },
            { tail: 1600 }
        )
        return page
    },
    async gifJumpInto() {
        const page = await sc.page(GIF_VIEW)
        await open(page, 'Jump into canoe')
        await gif(page, 'canoe-jump-into', await squares(page, ['A1', 'U14'], 0.9), () => press(page, 'M10'))
        return page
    }
})
