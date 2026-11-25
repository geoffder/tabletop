// Times picking Mexica's canal and temple tools in a 4-player first round, the position with the
// most candidates. Run in the container against a running harness:
//   node mexica-measure.mjs [harness URL]    SLOW=4 slows the CPU 4x, NOPROF=1 skips the profile.
// Prints each pick's target count and its query, wait-for-frame and paint times in ms, then the
// functions the profile spent most self time in.
import { showcase } from '../../game-showcase/scripts/showcase.mjs'
const sc_base = process.argv[2] ?? 'http://localhost:5217'
const sc = await showcase({
    ui: '/workspace/tmp/mexica-wt/games/mexica-ui',
    base: sc_base,
    out: '/tmp/mx-perf',
    global: 'mexicaSession',
    board: 'svg.mx-board'
})
const page = await sc.page({ width: 1440, height: 900, dpr: 2 })
await page.goto(sc_base, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
await page.locator('nav button, header button').nth(1).click()
await page.getByPlaceholder('choose a name for your game').fill('perf')
const names = page.locator('input[placeholder="player name"]:not([disabled])')
for (let i = 0; i < (await names.count()); i++) await names.nth(i).fill('P' + i)
await page.getByRole('button', { name: 'Create Game' }).click()
await page.waitForFunction(() => !!window.mexicaSession, null, { timeout: 30000 })
await sc.settle(page)
// The harness opens blank: create a game, then place every Pilli Mexica.
for (let i = 0; i < 6; i++) {
    const placed = await page.evaluate(async () => {
        const s = window.mexicaSession
        if (!s.canChooseStart) return false
        const cells = [...s.startCells]
        await s.chooseCell(cells[Math.floor(cells.length / 2)])
        return true
    })
    if (!placed) break
    await sc.settle(page)
}
const cdp = await page.context().newCDPSession(page)
if (process.env.SLOW) await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.SLOW) })
await cdp.send('Profiler.enable')
await cdp.send('Profiler.setSamplingInterval', { interval: 100 })
if (!process.env.NOPROF) await cdp.send('Profiler.start')
const report = await page.evaluate(async () => {
    const s = window.mexicaSession
    let rafAt = 0
    const frame = () => new Promise((r) => requestAnimationFrame(() => { rafAt = performance.now(); setTimeout(r, 0) }))
    const out = { firstRound: s.gameState.isFirstRound(), levels: s.templeLevels }
    for (const tool of ['canal', 1, 2, 3, 'canal']) {
        if (typeof tool === 'number' && !s.templeLevels.includes(tool)) continue
        const t0 = performance.now()
        s.pickTool(tool)
        const n = s.targets.size
        const t1 = performance.now()
        await frame()
        const t2 = performance.now()
        const rafPick = rafAt
        s.pickTool(tool)
        await frame()
        out[tool + ':' + Math.random().toString(36).slice(2, 5)] = { targets: n, query: Math.round(t1 - t0), toPaint: Math.round(t2 - t0), toFrame: Math.round(rafPick - t1), render: Math.round(t2 - rafPick) }
    }
    return out
})
const { profile } = process.env.NOPROF ? { profile: { nodes: [], samples: [], timeDeltas: [] } } : await cdp.send('Profiler.stop')
const self = new Map()
const dt = profile.timeDeltas
const byId = new Map(profile.nodes.map((n) => [n.id, n]))
const counts = new Map()
profile.samples.forEach((id, i) => counts.set(id, (counts.get(id) ?? 0) + (dt[i] ?? 0)))
for (const [id, us] of counts) {
    const f = byId.get(id).callFrame
    const key = `${f.functionName || '(anon)'} ${f.url.split('/').pop()}:${f.lineNumber + 1}`
    self.set(key, (self.get(key) ?? 0) + us)
}
console.log([...self].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, us]) => `${(us / 1000).toFixed(1).padStart(7)} ms  ${k}`).join('\n'))
console.log(JSON.stringify(report))
console.log(page.errors)
await page.context().close()
process.exit(0)
