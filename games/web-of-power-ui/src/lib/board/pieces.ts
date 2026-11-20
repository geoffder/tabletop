// What the board draws round the pieces (the pieces themselves are pre-rendered by
// scripts/render-pieces.mjs into pieceSprites.ts): an empty space's sketch, and where advisors
// stand on a coat of arms.

const point = (x: number, y: number) => `${x.toFixed(2)} ${y.toFixed(2)}`

// An empty space, as the board prints it: a small cloister sketched in ink, a tower with its spire
// beside the church. `size` is its width.
export function cloisterSketch(size: number): { fill: string; lines: string } {
    const s = size / 28
    const p = (x: number, y: number) => point(x * s, y * s)
    const fill = `M${p(-14, 0)} L${p(-14, -20)} L${p(-10.5, -28)} L${p(-7, -20)} L${p(-7, -11)} L${p(2, -18)} L${p(14, -11)} L${p(14, 0)} Z`
    const lines = [
        // tower and spire
        `M${p(-14, 0)} L${p(-14, -20)} L${p(-10.5, -28)} L${p(-7, -20)} L${p(-7, 0)}`,
        `M${p(-14, -20)} L${p(-7, -20)}`,
        // church and roof
        `M${p(-7, -11)} L${p(2, -18)} L${p(14, -11)} L${p(14, 0)}`,
        `M${p(-7, -11)} L${p(14, -11)}`,
        // door and window
        `M${p(1, 0)} L${p(1, -5)} A${2 * s} ${2 * s} 0 0 1 ${p(5, -5)} L${p(5, 0)}`,
        `M${p(-10.5, -13)} L${p(-10.5, -16)}`,
        // the ground
        `M${p(-17, 0)} L${p(17, 0)}`
    ].join(' ')
    return { fill, lines }
}

// Where a country's advisors stand on its coat of arms, round the emblem's middle as Indonesia
// sets its cubes round a square's number: one off the middle, two facing across it, more evenly
// round it. The ring is turned, and made wider or narrower, to hide as little of the emblem's key
// features (`avoid`, in the seal's units) as it can; then each advisor may slide a little along it,
// or in or out, to step off what it still covers, keeping clear of its neighbours. An advisor stands
// on a face or a head only when the seal is crowded. Every peg is then set a little off true, as if
// put down by hand; `seed` makes that the same on every screen. A peg's foot is its spot; it stands
// about 25 tall and 16 wide, so the ring's centre sits below the seal's to centre the pegs on it.
export function advisorRing(
    count: number,
    seed: number,
    avoid: readonly { x: number; y: number; r: number; weight: number }[] = [],
    sealRadius = 52
): { x: number; y: number }[] {
    if (count === 0) return []
    // Each feature as points spread over it, sharing its weight, so a peg hiding half of a
    // feature costs half of it.
    const samples = avoid.flatMap(({ x, y, r, weight }) => {
        const points = [[x, y]]
        for (const [share, many] of [
            [0.5, 6],
            [0.9, 10]
        ]) {
            for (let k = 0; k < many; k++) {
                const angle = (k * Math.PI * 2) / many
                points.push([x + Math.cos(angle) * r * share, y + Math.sin(angle) * r * share])
            }
        }
        return points.map(([px, py]) => ({ x: px, y: py, weight: weight / points.length }))
    })
    const covering = (x: number, y: number) =>
        samples.reduce(
            (sum, sample) =>
                sample.x > x - 9 && sample.x < x + 9 && sample.y > y - 26 && sample.y < y + 4
                    ? sum + sample.weight
                    : sum,
            0
        )
    const onSeal = (x: number, y: number) =>
        [
            [x - 8, y - 25],
            [x + 8, y - 25],
            [x - 8, y + 3],
            [x + 8, y + 3]
        ].every(([cx, cy]) => Math.hypot(cx, cy) < sealRadius - 3)
    // Two pegs clear each other side by side, or with one far enough behind the other to show.
    const apart = (a: { x: number; y: number }, b: { x: number; y: number }) =>
        Math.hypot((a.x - b.x) / 18, (a.y - b.y) / 15) >= 1
    const at = (radius: number, angle: number) => ({
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius * 0.92 + 10
    })

    // The ring: the turn and width hiding least, the usual width preferred when it makes no odds.
    let ring: { radius: number; angle: number }[] = []
    let ringCost = Infinity
    for (const radius of [29, 25, 33]) {
        if (count > 1 && 2 * radius * Math.sin(Math.PI / count) < 17) continue
        for (let degrees = 0; degrees < 360; degrees += 5) {
            const pegs = Array.from({ length: count }, (_, index) => ({
                radius,
                angle: ((degrees + (index * 360) / Math.max(count, 2)) * Math.PI) / 180
            }))
            const spots = pegs.map((peg) => at(peg.radius, peg.angle))
            if (!spots.every(({ x, y }) => onSeal(x, y))) continue
            const cost =
                spots.reduce((sum, { x, y }) => sum + covering(x, y), 0) +
                Math.abs(radius - 29) * 0.004
            if (cost < ringCost - 1e-9) {
                ring = pegs
                ringCost = cost
            }
        }
    }
    // More advisors than any ring holds apart (beyond the rules' reach): the usual ring, crowded.
    if (ring.length === 0) {
        ring = Array.from({ length: count }, (_, index) => ({
            radius: 29,
            angle: (index * Math.PI * 2) / count
        }))
    }

    // Each advisor steps off what it still covers, if a small move along or across the ring does.
    const spots = ring.map((peg) => at(peg.radius, peg.angle))
    for (let pass = 0; pass < 3; pass++) {
        ring.forEach((peg, index) => {
            const others = spots.filter((_, other) => other !== index)
            let best = spots[index]
            let bestCost = covering(best.x, best.y)
            for (let turn = -40; turn <= 40; turn += 5) {
                for (let reach = -12; reach <= 10; reach += 2) {
                    const spot = at(peg.radius + reach, peg.angle + (turn * Math.PI) / 180)
                    if (!onSeal(spot.x, spot.y) || !others.every((other) => apart(other, spot))) {
                        continue
                    }
                    // a small move only for a real gain
                    const cost =
                        covering(spot.x, spot.y) + (Math.abs(turn) + Math.abs(reach) * 2) * 0.0015
                    if (cost < bestCost - 1e-9) {
                        best = spot
                        bestCost = cost
                    }
                }
            }
            spots[index] = best
        })
    }

    const random = mulberry32(seed + count * 977)
    return spots.map(({ x, y }) => ({
        x: x + (random() * 2 - 1) * 2.5,
        y: y + (random() * 2 - 1) * 2.5
    }))
}

function mulberry32(seed: number): () => number {
    let state = seed >>> 0
    return () => {
        state = (state + 0x6d2b79f5) >>> 0
        let t = state
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}
