import { mkdirSync, rmSync, writeFileSync } from 'node:fs'

// Showcase captures from a title's dev harness: still screenshots, and GIF frames that keep the
// time each frame was painted, so the GIF plays at the speed the game played. A title's own
// capture script imports this (in the container, as the node user) and lists its jobs; see
// ../SKILL.md. Encode the GIFs afterwards on the host with encode.sh.
//
//   import { showcase } from '/workspace/tmp/gbs-wt/.agents/skills/game-showcase/scripts/showcase.mjs'
//   const sc = await showcase({
//       ui: '/workspace/tmp/<slug>-wt/games/<slug>-ui', // its node_modules has Playwright
//       base: 'http://localhost:<port>',
//       out: '/workspace/tmp/<slug>/showcase',
//       global: '<slug>Session', // window name the session is exposed under
//       board: 'svg.<prefix>-board'
//   })
//   await sc.run({ async table() { const page = await sc.page(); ...; return page } })

export async function showcase({
    ui,
    base,
    out,
    global = 'gameSession',
    board,
    // The harness keeps the session in a Svelte context; this rewrite of the module as Vite serves
    // it puts it on the window too.
    expose = {
        module: '**/model/sessionContext.svelte.ts*',
        from: 'return getContext();',
        to: `return window.${global} = getContext();`
    }
}) {
    const { chromium } = await import(`${ui}/node_modules/@playwright/test/index.mjs`)
    mkdirSync(`${out}/shots`, { recursive: true })
    mkdirSync(`${out}/gifs`, { recursive: true })
    const browser = await chromium.launch()

    // Screenshots at 2x; GIF pages want a big viewport at 1x instead (see gif()).
    async function page({ width = 1440, height = 900, dpr = 2 } = {}) {
        const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr })
        const page = await context.newPage()
        page.errors = []
        page.on('pageerror', (e) => page.errors.push(e.message))
        page.on('console', (m) => m.type() === 'error' && page.errors.push(m.text()))
        await page.route(expose.module, async (route) => {
            const response = await route.fetch()
            const body = await response.text()
            if (!body.includes(expose.from)) throw Error(`Session module not served as expected: ${expose.from}`)
            await route.fulfill({ response, body: body.replace(expose.from, expose.to) })
        })
        return page
    }

    // Waits until the session has shown every state it was given.
    async function settle(page) {
        await page.waitForFunction((name) => window[name] && !window[name].updatingVisibleState, global)
        await page.waitForTimeout(150)
    }

    // Opens the harness, and a scenario from its menu when named. The mouse is parked in a corner
    // so no hover preview shows.
    async function open(page, scenario) {
        await page.goto(base + '/', { waitUntil: 'networkidle' })
        await page.waitForTimeout(800)
        if (scenario) {
            await page.getByRole('button', { name: 'Scenarios' }).click()
            await page.getByText(scenario, { exact: true }).click()
        }
        await page.waitForFunction((name) => !!window[name], global)
        await settle(page)
        await page.mouse.move(0, 0)
        await page.waitForTimeout(600)
    }

    // A board button by its accessible name, by keyboard: it reaches the button wherever a piece
    // stands over it, where a click or hover would land on the piece.
    const press = (page, name) => page.getByRole('button', { name, exact: true }).first().press('Enter')

    // The names of the board buttons a tap would choose now.
    const choices = (page, selector = `${board} .hit.active`) =>
        page.evaluate(
            (selector) => [...document.querySelectorAll(selector)].map((node) => node.getAttribute('aria-label')),
            selector
        )

    // The box holding every given box, padded, and kept within `within` (a box; the board's by
    // default). Pad more above for tall pieces.
    async function around(page, boxes, { pad = 20, top = pad, within } = {}) {
        within ??= await page.locator(board).boundingBox()
        const x = Math.max(Math.min(...boxes.map((b) => b.x)) - pad, within.x)
        const y = Math.max(Math.min(...boxes.map((b) => b.y)) - top, within.y)
        const right = Math.min(Math.max(...boxes.map((b) => b.x + b.width)) + pad, within.x + within.width)
        const bottom = Math.min(Math.max(...boxes.map((b) => b.y + b.height)) + pad, within.y + within.height)
        return { x, y, width: right - x, height: bottom - y }
    }

    // A still of the page below the harness's own bar, or of one element.
    async function shot(page, name, locator) {
        const path = `${out}/shots/${name}.png`
        if (locator) await locator.screenshot({ path })
        else {
            const below = await page.evaluate(
                () => document.querySelector('nav, header')?.getBoundingClientRect().bottom ?? 0
            )
            const view = page.viewportSize()
            await page.screenshot({ path, clip: { x: 0, y: below, width: view.width, height: view.height - below } })
        }
        console.log('shot', name)
    }

    // Records `act` and leaves the frames of `region` (a locator, or a box in CSS pixels) in
    // gifs/.<name>/ for encode.sh, each with the time until the next. `lead` and `tail` hold
    // stills before and after; `width` caps the GIF's width.
    //
    // A CDP screencast sends frames at CSS-pixel size whatever the device scale, so a sharp GIF
    // comes from a big viewport at 1x (2400x1500), where the board itself draws bigger.
    async function gif(page, name, region, act, { lead = 700, tail = 1200, width } = {}) {
        const box = typeof region.boundingBox === 'function' ? await region.boundingBox() : region
        const view = page.viewportSize()
        const cdp = await page.context().newCDPSession(page)
        const frames = []
        cdp.on('Page.screencastFrame', async (frame) => {
            frames.push({ data: frame.data, t: frame.metadata.timestamp, w: frame.metadata.deviceWidth })
            await cdp.send('Page.screencastFrameAck', { sessionId: frame.sessionId }).catch(() => {})
        })
        await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 })
        // A screencast only sends a frame when something paints: a near-invisible pixel flickers
        // so the stills before and after the motion have frames too.
        await page.evaluate(() => {
            const dot = document.createElement('div')
            dot.id = 'cast-tick'
            dot.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;pointer-events:none'
            document.body.append(dot)
            let on = false
            window.castTick = setInterval(() => {
                on = !on
                dot.style.background = on ? 'rgba(0,0,0,0.004)' : 'rgba(0,0,0,0.006)'
            }, 30)
        })
        await page.waitForTimeout(lead)
        const started = Date.now()
        await act()
        await settle(page)
        const ran = Date.now() - started
        await page.waitForTimeout(tail)
        await cdp.send('Page.stopScreencast')
        await page.evaluate(() => {
            clearInterval(window.castTick)
            document.getElementById('cast-tick')?.remove()
        })
        await cdp.detach()

        const dir = `${out}/gifs/.${name}`
        rmSync(dir, { recursive: true, force: true })
        mkdirSync(dir, { recursive: true })
        const file = (index) => `${String(index).padStart(5, '0')}.png`
        let list = ''
        frames.forEach((frame, index) => {
            writeFileSync(`${dir}/${file(index)}`, Buffer.from(frame.data, 'base64'))
            const next = frames[index + 1]?.t ?? frame.t + 0.05
            list += `file '${file(index)}'\nduration ${(next - frame.t).toFixed(4)}\n`
        })
        list += `file '${file(frames.length - 1)}'\n`
        writeFileSync(`${dir}/list.txt`, list)
        const scale = frames[0].w / view.width
        const crop = [box.width, box.height, box.x, box.y].map((v) => Math.round(v * scale)).join(':')
        width ??= Math.min(900, Math.round(box.width * scale))
        width -= width % 2
        writeFileSync(`${dir}/encode.json`, JSON.stringify({ crop, width }))
        const span = frames.at(-1).t - frames[0].t
        console.log('gif', name, `${frames.length} frames over ${span.toFixed(2)} s, action ${ran} ms`)
    }

    // Runs the named jobs (all when none are named on the command line), each on its own page.
    async function run(jobs, only = process.argv.slice(2)) {
        for (const [name, job] of Object.entries(jobs)) {
            if (only.length && !only.includes(name)) continue
            try {
                const done = await job()
                if (done?.errors?.length) console.log(name, 'PAGE ERRORS', done.errors)
                await done?.context().close()
            } catch (error) {
                console.log(name, 'FAILED', error.message.split('\n')[0])
            }
        }
        await browser.close()
    }

    return { page, open, settle, press, choices, around, shot, gif, run, board: (p) => p.locator(board) }
}
