// What the board draws round the pieces (the pieces themselves are pre-rendered by
// scripts/render-pieces.mjs into pieceSprites.ts): an empty space's drawing, and where advisors
// stand on a coat of arms.

const point = (x: number, y: number) => `${x.toFixed(2)} ${y.toFixed(2)}`

// An empty space, as the board prints it: a cloister drawn in ink, a square tower with a capped
// top beside a long, low hall under a pitched roof, on a stepped base. Drawn in the design's units
// (foot at the origin, 40 wide, 31 tall), scaled by CLOISTER_SCALE.
export const CLOISTER_SCALE = 42 / 38

// The drawing's outline, unwobbled, in board units about its foot: emit.py in
// /workspace/tmp/web-of-power/map cuts each road where it meets this, so no road runs under a
// drawing, as on the printed board. Change both together.
export const CLOISTER_FOOTPRINT: readonly (readonly [number, number])[] = [
    [-15, -5],
    [-15, -23],
    [-16.5, -23],
    [-11.5, -31],
    [-6.5, -23],
    [-8, -23],
    [-8, -12],
    [-5, -18],
    [12, -18],
    [15, -12],
    [15, -5],
    [18, -5],
    [18, -2],
    [20, -2],
    [20, 0],
    [-20, 0],
    [-20, -2],
    [-18, -2],
    [-18, -5]
].map(([x, y]) => [x * CLOISTER_SCALE, y * CLOISTER_SCALE] as const)

type Stroke = { points: [number, number][]; fine?: boolean; overshoot?: boolean }

const arch = (x: number, width: number, top: number, bottom: number): [number, number][] => {
    const r = width / 2
    const springs = top + r
    const curve: [number, number][] = []
    for (let k = 0; k <= 6; k++) {
        const angle = Math.PI + (k * Math.PI) / 6
        curve.push([x + Math.cos(angle) * r, springs + Math.sin(angle) * r])
    }
    return [[x - r, bottom], ...curve, [x + r, bottom]]
}

const CLOISTER_STROKES: Stroke[] = [
    // the tower, its cap and a slit window
    {
        points: [
            [-15, -5],
            [-15, -23]
        ],
        overshoot: true
    },
    {
        points: [
            [-8, -5],
            [-8, -23]
        ],
        overshoot: true
    },
    {
        points: [
            [-16.5, -23],
            [-6.5, -23]
        ],
        overshoot: true
    },
    {
        points: [
            [-16.5, -23],
            [-11.5, -31],
            [-6.5, -23]
        ]
    },
    {
        points: [
            [-11.5, -19.5],
            [-11.5, -16]
        ],
        fine: true
    },
    {
        points: [
            [-9.6, -21.5],
            [-9.6, -7]
        ],
        fine: true
    },
    // the hall: roof, eaves, wall, door, windows and a few tiles
    {
        points: [
            [-8, -12],
            [-5, -18],
            [12, -18],
            [15, -12]
        ]
    },
    {
        points: [
            [15, -12],
            [15, -5]
        ],
        overshoot: true
    },
    {
        points: [
            [-8, -12],
            [15, -12]
        ],
        overshoot: true
    },
    { points: arch(-3, 3.2, -10, -5), fine: true },
    { points: arch(3.5, 2.2, -10.5, -7.5), fine: true },
    { points: arch(8.5, 2.2, -10.5, -7.5), fine: true },
    {
        points: [
            [-2.5, -17],
            [-4.5, -13]
        ],
        fine: true
    },
    {
        points: [
            [3, -17],
            [1.6, -13]
        ],
        fine: true
    },
    {
        points: [
            [8.5, -17],
            [7.4, -13]
        ],
        fine: true
    },
    // the stepped base, its lower step rough as rock
    {
        points: [
            [-18, -5],
            [18, -5]
        ],
        overshoot: true
    },
    {
        points: [
            [-18, -5],
            [-18, -2]
        ]
    },
    {
        points: [
            [18, -5],
            [18, -2]
        ]
    },
    {
        points: [
            [-20, -2],
            [20, -2]
        ],
        overshoot: true
    },
    {
        points: [
            [-20, -2],
            [-20, 0]
        ]
    },
    {
        points: [
            [20, -2],
            [20, 0]
        ]
    },
    {
        points: [
            [-21, 0],
            [21, 0]
        ],
        overshoot: true
    },
    {
        points: [
            [-12, -2],
            [-13, 0]
        ],
        fine: true
    },
    {
        points: [
            [-4, -2],
            [-3.5, 0]
        ],
        fine: true
    },
    {
        points: [
            [5, -2],
            [4.2, 0]
        ],
        fine: true
    },
    {
        points: [
            [13, -2],
            [13.6, 0]
        ],
        fine: true
    }
]

// The drawing of one space, its lines a little unsteady as if inked by hand, each space's its own
// (`seed`): every line wavers slightly along its length, sits a touch off true, and some run a
// little past their corners. `outline` is drawn in the heavier pen, `detail` in the finer; `at`
// places the drawing's foot on the board.
export function cloisterDrawing(
    seed: number,
    at: { x: number; y: number } = { x: 0, y: 0 }
): { outline: string; detail: string } {
    const random = mulberry32(seed * 7919 + 13)
    const wobble = () => (random() * 2 - 1) * 0.45
    const k = CLOISTER_SCALE
    const outline: string[] = []
    const detail: string[] = []
    for (const stroke of CLOISTER_STROKES) {
        // Ends land a little apart, so corners neither meet exactly nor match space to space.
        let points = stroke.points.map(
            ([x, y]) => [x + wobble() * 0.8, y + wobble() * 0.8] as [number, number]
        )
        const [dx, dy] = [wobble(), wobble()]
        if (stroke.overshoot && points.length === 2) {
            const [[ax, ay], [bx, by]] = points
            const length = Math.hypot(bx - ax, by - ay)
            const [ux, uy] = [(bx - ax) / length, (by - ay) / length]
            const before = random() * 1.3
            const after = random() * 1.3
            points = [
                [ax - ux * before, ay - uy * before],
                [bx + ux * after, by + uy * after]
            ]
        }
        // Long lines bend gently along their length: a few points set off them, sideways.
        const drawn: [number, number][] = [points[0]]
        for (let index = 1; index < points.length; index++) {
            const [ax, ay] = points[index - 1]
            const [bx, by] = points[index]
            const length = Math.hypot(bx - ax, by - ay)
            const pieces = Math.max(1, Math.round(length / 4))
            for (let step = 1; step <= pieces; step++) {
                const t = step / pieces
                const off = step < pieces ? (random() * 2 - 1) * 0.6 : 0
                drawn.push([
                    ax + (bx - ax) * t - ((by - ay) / length) * off,
                    ay + (by - ay) * t + ((bx - ax) / length) * off
                ])
            }
        }
        const d = drawn
            .map(
                ([x, y], index) =>
                    `${index === 0 ? 'M' : 'L'}${point(at.x + (x + dx) * k, at.y + (y + dy) * k)}`
            )
            .join('')
        ;(stroke.fine ? detail : outline).push(d)
    }
    return { outline: outline.join(' '), detail: detail.join(' ') }
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

export function mulberry32(seed: number): () => number {
    let state = seed >>> 0
    return () => {
        state = (state + 0x6d2b79f5) >>> 0
        let t = state
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}
