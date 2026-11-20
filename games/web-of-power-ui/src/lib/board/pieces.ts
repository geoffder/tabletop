// The two pieces, drawn standing on the map and seen from the near side, the light from the upper
// left: a cloister is a small wooden house showing its gable end and right side, an advisor a
// wooden peg. Each foot stands on its point.

export type HouseShape = {
    front: string
    side: string
    roof: string
    outline: string
    shadow: { cx: number; cy: number; rx: number; ry: number }
    // The centre of the house's outline, for the choice ring round it.
    centre: { x: number; y: number }
    reach: number
}

const point = (x: number, y: number) => `${x.toFixed(2)} ${y.toFixed(2)}`

// A house whose gable end is `size` wide.
export function houseShape(size: number): HouseShape {
    const a = size / 2
    const wall = size * 0.62
    const ridge = size * 0.5
    const dx = size * 0.26
    const dy = -size * 0.2
    const peak = -wall - ridge
    const front = `M${point(-a, 0)} L${point(a, 0)} L${point(a, -wall)} L${point(0, peak)} L${point(-a, -wall)} Z`
    const side = `M${point(a, 0)} L${point(a + dx, dy)} L${point(a + dx, -wall + dy)} L${point(a, -wall)} Z`
    const roof = `M${point(0, peak)} L${point(dx, peak + dy)} L${point(a + dx, -wall + dy)} L${point(a, -wall)} Z`
    const outline = `M${point(-a, 0)} L${point(a, 0)} L${point(a + dx, dy)} L${point(a + dx, -wall + dy)} L${point(dx, peak + dy)} L${point(0, peak)} L${point(-a, -wall)} Z`
    return {
        front,
        side,
        roof,
        outline,
        shadow: {
            cx: dx * 0.5 + size * 0.1,
            cy: dy * 0.5 + size * 0.06,
            rx: a + dx * 0.5 + size * 0.12,
            ry: size * 0.28
        },
        centre: { x: dx / 2, y: (peak + dy) / 2 },
        reach: Math.hypot(a + dx / 2, (peak + dy) / 2) + size * 0.08
    }
}

export type PegShape = {
    body: string
    shade: string
    top: string
    shadow: { cx: number; cy: number; rx: number; ry: number }
}

// A peg `size` across.
export function pegShape(size: number): PegShape {
    const r = size / 2
    const e = r * 0.42
    const h = size * 1.35
    const body = `M${point(-r, 0)} L${point(-r, -h)} A${r} ${e} 0 0 1 ${point(r, -h)} L${point(r, 0)} A${r} ${e} 0 0 1 ${point(-r, 0)} Z`
    const shade = `M${point(r * 0.35, e * 0.94)} L${point(r * 0.35, -h + e * 0.94)} A${r} ${e} 0 0 0 ${point(r, -h)} L${point(r, 0)} A${r} ${e} 0 0 1 ${point(r * 0.35, e * 0.94)} Z`
    const top = `M${point(-r, -h)} A${r} ${e} 0 0 1 ${point(r, -h)} A${r} ${e} 0 0 1 ${point(-r, -h)} Z`
    return { body, shade, top, shadow: { cx: r * 0.35, cy: e * 0.4, rx: r * 1.35, ry: e * 1.5 } }
}

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

// Where a country's advisors stand on its coat of arms, round the emblem's middle so it stays
// in view, as Indonesia sets its cubes round a square's number: one off the middle, two facing
// across it, more evenly round it, each seal's ring turned its own way and every peg a little
// off true, as if set down by hand. A peg's foot is its spot; it stands about 24 tall, so the
// ring's centre sits below the seal's to centre the pegs on the emblem.
export function advisorRing(count: number, seed: number): { x: number; y: number }[] {
    const random = mulberry32(seed + count * 977)
    const radius = 29
    const turn = random() * Math.PI * 2
    const spots: { x: number; y: number }[] = []
    for (let index = 0; index < count; index++) {
        const angle = turn + (index * Math.PI * 2) / Math.max(count, 2)
        spots.push({
            x: Math.cos(angle) * radius + (random() * 2 - 1) * 2.5,
            y: Math.sin(angle) * radius * 0.92 + 10 + (random() * 2 - 1) * 2.5
        })
    }
    return spots
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
