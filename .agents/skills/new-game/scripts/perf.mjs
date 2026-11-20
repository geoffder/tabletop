// Phone-stand-in timings of a game's harness (see references/performance.md). Run in the container:
//   GAME_UI=<slug>-ui [BROWSER=webkit] [THROTTLE=4] [PROFILE=open|move] [PORT=5173] \
//     node .agents/skills/new-game/scripts/perf.mjs '<scenario name>' '<tap selector>'...
// Opens the scenario from the harness's Scenarios menu, waits for BOARD (a CSS selector, default
// 'svg [aria-label]'), then taps each selector in turn, timing the frames for MOVE_MS after each.
// THROTTLE slows Chromium's CPU; WebKit cannot be throttled. PROFILE adds a CPU profile (Chromium)
// of the opening or of the last tap.
const ui = process.env.GAME_UI
if (!ui) throw Error('Set GAME_UI to the game UI package folder, e.g. GAME_UI=matrx-ui')
const pw = await import(`/workspace/games/${ui}/node_modules/@playwright/test/index.mjs`)
const engine = process.env.BROWSER ?? 'chromium'
const throttle = Number(process.env.THROTTLE ?? 1)
const board = process.env.BOARD ?? 'svg [aria-label]'
const moveMs = Number(process.env.MOVE_MS ?? 1200)
const profileWhat = engine === 'chromium' ? process.env.PROFILE : undefined
const [scenario, ...taps] = process.argv.slice(2)
if (!scenario) throw Error('Name the scenario to open, then the selectors to tap')

const browser = await pw[engine].launch()
const context = await browser.newContext({
    viewport: { width: 390, height: 655 },
    deviceScaleFactor: 3,
    ...(engine === 'webkit' ? {} : { isMobile: true }),
    hasTouch: true
})
const page = await context.newPage()
await page.goto(`http://localhost:${process.env.PORT ?? 5173}/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
const cdp = engine === 'chromium' ? await context.newCDPSession(page) : undefined

await page.evaluate(() => {
    window.__long = []
    try {
        new PerformanceObserver((list) =>
            list.getEntries().forEach((entry) => window.__long.push(Math.round(entry.duration)))
        ).observe({ type: 'longtask' })
    } catch {
        // WebKit has no long-task timing.
    }
})

// Frame timings over the next `ms`: the slow frames are listed with when they started.
function frames(ms) {
    return page.evaluate(
        (ms) =>
            new Promise((resolve) => {
                const times = []
                const start = performance.now()
                const tick = (time) => {
                    times.push(time)
                    if (time - start < ms) return requestAnimationFrame(tick)
                    const gaps = times.slice(1).map((time, index) => time - times[index])
                    resolve({
                        fps: Math.round((times.length / ms) * 1000),
                        worst: Math.round(Math.max(...gaps)),
                        slow: gaps
                            .map((gap, index) => [Math.round(times[index] - start), Math.round(gap)])
                            .filter(([, gap]) => gap > 40)
                    })
                }
                requestAnimationFrame(tick)
            }),
        ms
    )
}

async function profiled(run) {
    await cdp.send('Profiler.enable')
    await cdp.send('Profiler.setSamplingInterval', { interval: 200 })
    await cdp.send('Profiler.start')
    await browser.startTracing(page, { categories: ['devtools.timeline'] })
    await run()
    const { profile } = await cdp.send('Profiler.stop')
    const trace = JSON.parse((await browser.stopTracing()).toString())
    const byId = new Map(profile.nodes.map((node) => [node.id, node]))
    const parent = new Map()
    for (const node of profile.nodes) for (const child of node.children ?? []) parent.set(child, node.id)
    const name = ({ functionName, url, lineNumber }) =>
        `${functionName || '(anon)'} ${url.split('/').slice(-2).join('/')}:${lineNumber}`
    const self = new Map()
    const inclusive = new Map()
    profile.samples.forEach((id, index) => {
        const ms = (profile.timeDeltas[index] ?? 0) / 1000
        const key = name(byId.get(id).callFrame)
        self.set(key, (self.get(key) ?? 0) + ms)
        const seen = new Set()
        for (let at = id; at !== undefined; at = parent.get(at)) {
            const frame = byId.get(at).callFrame
            if (!frame.url.includes('/src/')) continue
            const appKey = name(frame)
            if (seen.has(appKey)) continue
            seen.add(appKey)
            inclusive.set(appKey, (inclusive.get(appKey) ?? 0) + ms)
        }
    })
    const phases = {}
    for (const event of trace.traceEvents) {
        if (event.ph !== 'X' || !event.dur) continue
        if (['UpdateLayoutTree', 'Layout', 'PrePaint', 'Paint', 'Layerize', 'FunctionCall'].includes(event.name)) {
            phases[event.name] = Math.round((phases[event.name] ?? 0) + event.dur / 1000)
        }
    }
    const top = (map) =>
        [...map]
            .filter(([key]) => !key.startsWith('(idle)'))
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15)
            .map(([key, ms]) => `${String(Math.round(ms)).padStart(6)} ${key}`)
    console.log('phases (ms, style is UpdateLayoutTree)', JSON.stringify(phases))
    console.log('self time\n' + top(self).join('\n'))
    console.log('inclusive, app code\n' + top(inclusive).join('\n'))
}

await page.locator('button:has-text("Scenarios")').first().tap()
await page.waitForTimeout(400)
await cdp?.send('Emulation.setCPUThrottlingRate', { rate: throttle })

let openedMs = 0
const open = async () => {
    const start = Date.now()
    await page.locator(`text="${scenario}" >> visible=true`).first().tap()
    await page.locator(board).first().waitFor({ state: 'attached', timeout: 120000 })
    openedMs = Date.now() - start
    await page.waitForTimeout(2500)
}
if (profileWhat === 'open') await profiled(open)
else await open()
const openLong = await page.evaluate(() => window.__long.splice(0))

const moves = []
for (const [index, selector] of taps.entries()) {
    const tap = async () => {
        await page.locator(selector).first().tap()
        moves.push({ tap: selector, ...(await frames(moveMs)) })
    }
    if (profileWhat === 'move' && index === taps.length - 1) await profiled(tap)
    else await tap()
}
const moveLong = await page.evaluate(() => window.__long.splice(0))
const svgElements = await page.evaluate(() => document.querySelectorAll('svg *').length)

console.log(JSON.stringify({ engine, throttle, scenario, openedMs, openLong, moves, moveLong, svgElements }, null, 1))
await browser.close()
