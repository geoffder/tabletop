// Ray-marching takes a few seconds, so the pieces' light is rendered here, not as a game opens. The
// light is black and white over the player's colour, so one image serves every colour.
// Rerun after changing a piece: pnpm run render-pieces
import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const IMAGES = join(ROOT, 'src', 'lib', 'images')

// Pixels per map unit: 2.5 times the board's largest scale on screen, 1.12 (1617 px wide at
// 2560x1440 in full screen); it never reaches GameTable's maxFitScale of 1.5.
const SCALE = 2.5 * 1.12
const SAMPLES = 3

const LOOK = { ambient: 0.8, diffuse: 0.58, broad: 0.05, tight: 0.08, grain: 0.045, rim: 0.24 }

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const len = (a) => Math.hypot(a[0], a[1], a[2])
const norm = (a) => mul(a, 1 / len(a))
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x))

// The board's hand-drawn house shifts each unit of depth 0.442 right and 0.34 up the screen.
function oblique(kx, ky) {
    const toViewer = norm([kx, ky, 1])
    return {
        toViewer,
        screenOf: (p) => [p[0] - kx * p[2], -p[1] + ky * p[2]],
        ray: (u, v) => ({ origin: [u + kx * 200, ky * 200 - v, 200], direction: mul(toViewer, -1) })
    }
}

function from(pitch) {
    const p = (pitch * Math.PI) / 180
    const toViewer = [0, Math.sin(p), Math.cos(p)]
    const up = [0, Math.cos(p), -Math.sin(p)]
    return {
        toViewer,
        screenOf: (q) => [q[0], -dot(q, up)],
        ray: (u, v) => ({
            origin: add(add([u, 0, 0], mul(up, -v)), mul(toViewer, 200)),
            direction: mul(toViewer, -1)
        })
    }
}

const LIGHT = norm([-0.05, 1, 0.38])
// The ground shadow falls down and to the right on the screen, as the board's shadows always have.
const SHADOW_LIGHT = norm([-0.4, 1, -0.3])

function box(p, half) {
    const q = [Math.abs(p[0]) - half[0], Math.abs(p[1]) - half[1], Math.abs(p[2]) - half[2]]
    const outside = len([Math.max(q[0], 0), Math.max(q[1], 0), Math.max(q[2], 0)])
    return outside + Math.min(Math.max(q[0], q[1], q[2]), 0)
}

// Its foot, the origin, is the middle of the front edge.
const HOUSE = { width: 34, wall: 21.08, ridge: 17, depth: 20, round: 1.8 }
const GABLE = [
    [-HOUSE.width / 2, 0],
    [HOUSE.width / 2, 0],
    [HOUSE.width / 2, HOUSE.wall],
    [0, HOUSE.wall + HOUSE.ridge],
    [-HOUSE.width / 2, HOUSE.wall]
]
const INNER = GABLE.map((_, i) => {
    const edge = (k) => {
        const [a, b] = [GABLE[(k + GABLE.length) % GABLE.length], GABLE[(k + 1) % GABLE.length]]
        const [dx, dy] = [b[0] - a[0], b[1] - a[1]]
        const l = Math.hypot(dx, dy)
        const inward = [-dy / l, dx / l]
        return {
            p: [a[0] + inward[0] * HOUSE.round, a[1] + inward[1] * HOUSE.round],
            d: [dx / l, dy / l]
        }
    }
    const [e1, e2] = [edge(i - 1), edge(i)]
    const det = e1.d[0] * -e2.d[1] - e1.d[1] * -e2.d[0]
    const t = ((e2.p[0] - e1.p[0]) * -e2.d[1] - (e2.p[1] - e1.p[1]) * -e2.d[0]) / det
    return [e1.p[0] + e1.d[0] * t, e1.p[1] + e1.d[1] * t]
})
// The exact distance to a polygon (Inigo Quilez's sdPolygon).
function polygon(v, x, y) {
    let d = (x - v[0][0]) ** 2 + (y - v[0][1]) ** 2
    let s = 1
    for (let i = 0, j = v.length - 1; i < v.length; j = i, i++) {
        const e = [v[j][0] - v[i][0], v[j][1] - v[i][1]]
        const w = [x - v[i][0], y - v[i][1]]
        const h = clamp((w[0] * e[0] + w[1] * e[1]) / (e[0] * e[0] + e[1] * e[1]), 0, 1)
        d = Math.min(d, (w[0] - e[0] * h) ** 2 + (w[1] - e[1] * h) ** 2)
        const c = [y >= v[i][1], y < v[j][1], e[0] * w[1] > e[1] * w[0]]
        if ((c[0] && c[1] && c[2]) || (!c[0] && !c[1] && !c[2])) s = -s
    }
    return s * Math.sqrt(d)
}
function house(p) {
    const across = polygon(INNER, p[0], p[1])
    const along = Math.abs(p[2] + HOUSE.depth / 2) - (HOUSE.depth / 2 - HOUSE.round)
    return (
        Math.min(Math.max(across, along), 0) +
        Math.hypot(Math.max(across, 0), Math.max(along, 0)) -
        HOUSE.round
    )
}

const PEG = { radius: 8, height: 23.8, round: 1.5 }
function peg(p) {
    const { radius, height, round } = PEG
    const across = Math.hypot(p[0], p[2]) - (radius - round)
    const along = Math.abs(p[1] - height / 2) - (height / 2 - round)
    return (
        Math.min(Math.max(across, along), 0) +
        Math.hypot(Math.max(across, 0), Math.max(along, 0)) -
        round
    )
}

function normalAt(sdf, p) {
    const e = 0.04
    return norm([
        sdf(add(p, [e, 0, 0])) - sdf(sub(p, [e, 0, 0])),
        sdf(add(p, [0, e, 0])) - sdf(sub(p, [0, e, 0])),
        sdf(add(p, [0, 0, e])) - sdf(sub(p, [0, 0, e]))
    ])
}

function march(sdf, { origin, direction }) {
    let t = 0
    for (let step = 0; step < 240 && t < 500; step++) {
        const d = sdf(add(origin, mul(direction, t)))
        if (d < 0.01) return t
        t += d * 0.9
    }
    return -1
}

function occlusion(sdf, p, n) {
    let hidden = 0
    let weight = 1
    for (let k = 1; k <= 5; k++) {
        const h = k * 1.4
        hidden += weight * (h - sdf(add(p, mul(n, h))))
        weight *= 0.6
    }
    return clamp(hidden / 5, 0, 1)
}

function softShadow(sdf, p, toward, k) {
    let lit = 1
    let t = 0.3
    for (let step = 0; step < 64 && t < 80; step++) {
        const d = sdf(add(p, mul(toward, t)))
        if (d < 0.001) return 0
        lit = Math.min(lit, (k * d) / t)
        t += clamp(d, 0.3, 4)
    }
    return clamp(lit, 0, 1)
}

const wobble = (a, b) =>
    Math.sin(a * 0.31 + b * 0.11) * 1.4 + Math.sin(a * 0.83 + 1.7) * 0.5 + Math.sin(b * 0.57) * 0.4
const fine = (x) =>
    Math.sin(x * 2.9) * 0.55 + Math.sin(x * 5.3 + 1.1) * 0.3 + Math.sin(x * 9.7 + 2.3) * 0.15
const houseGrain = (p) => fine(p[1] * 0.9 + p[0] * 0.35 + wobble(p[2], p[0]))
const pegGrain = (p) => fine(Math.atan2(p[2], p[0]) * 9 + wobble(p[1], p[0]) * 0.6)

function sample(piece, u, v) {
    const ray = piece.view.ray(u, v)
    const t = march(piece.sdf, ray)
    if (t < 0) {
        const tg = ray.origin[1] / -ray.direction[1]
        const g = add(ray.origin, mul(ray.direction, tg))
        const sky = softShadow(piece.sdf, g, SHADOW_LIGHT, 3)
        const contact = clamp(1 - piece.sdf(g) / 5, 0, 1)
        return [0, clamp((1 - sky) * 0.3 + contact * contact * 0.32, 0, 0.5)]
    }
    const p = add(ray.origin, mul(ray.direction, t))
    const n = normalAt(piece.sdf, p)
    const toViewer = piece.view.toViewer
    const half = norm(add(LIGHT, toViewer))
    const diffuse =
        Math.max(dot(n, LIGHT), 0) *
        (0.4 + 0.6 * softShadow(piece.sdf, add(p, mul(n, 0.2)), LIGHT, 6))
    const ao = 1 - occlusion(piece.sdf, p, n) * 0.5
    const facing = Math.max(dot(n, toViewer), 0)
    let light = (LOOK.ambient * ao + LOOK.diffuse * diffuse) * (1 - LOOK.rim * (1 - facing) ** 2.5)
    light *= 1 + LOOK.grain * piece.grain(p)
    const h = Math.max(dot(n, half), 0)
    light += LOOK.broad * h ** 16 + LOOK.tight * h ** 90
    // Black over the colour darkens it by `1 - light`; white lightens it.
    return light < 1 ? [0, 1 - light] : [1, Math.min(light - 1, 1)]
}

function render(piece) {
    const [x0, y0, x1, y1] = piece.bounds
    const width = Math.ceil((x1 - x0) * SCALE)
    const height = Math.ceil((y1 - y0) * SCALE)
    const rgba = new Uint8ClampedArray(width * height * 4)
    // The outline is traced at a fixed 15 to 17 samples per map unit, whatever the light's size, so
    // its edges simplify to straight lines.
    const fine = Math.ceil(15 / SCALE)
    const [fw, fh] = [width * fine, height * fine]
    const mask = new Uint8Array(fw * fh)
    for (let py = 0; py < fh; py++) {
        for (let px = 0; px < fw; px++) {
            const ray = piece.view.ray(
                x0 + (px + 0.5) / (SCALE * fine),
                y0 + (py + 0.5) / (SCALE * fine)
            )
            mask[py * fw + px] = march(piece.sdf, ray) >= 0 ? 1 : 0
        }
    }
    for (let py = 0; py < height; py++) {
        for (let px = 0; px < width; px++) {
            let white = 0
            let alpha = 0
            for (let sy = 0; sy < SAMPLES; sy++) {
                for (let sx = 0; sx < SAMPLES; sx++) {
                    const [w, a] = sample(
                        piece,
                        x0 + (px + (sx + 0.5) / SAMPLES) / SCALE,
                        y0 + (py + (sy + 0.5) / SAMPLES) / SCALE
                    )
                    white += w * a
                    alpha += a
                }
            }
            const i = (py * width + px) * 4
            rgba[i] = rgba[i + 1] = rgba[i + 2] = alpha > 0 ? Math.round((white / alpha) * 255) : 0
            rgba[i + 3] = Math.round((alpha / (SAMPLES * SAMPLES)) * 255)
        }
    }
    return { ...piece, width, height, rgba, outline: outline(mask, fw, fh, x0, y0, SCALE * fine) }
}

function outline(mask, w, h, x0, y0, scale) {
    const at = (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? mask[y * w + x] : 0)
    let start
    for (let y = 0; y < h && !start; y++)
        for (let x = 0; x < w && !start; x++) if (at(x, y)) start = [x, y]
    const steps = [
        [1, 0],
        [0, 1],
        [-1, 0],
        [0, -1]
    ]
    const points = []
    let dir = 0
    let corner = start
    do {
        points.push(corner)
        for (const turn of [3, 0, 1, 2]) {
            const nd = (dir + turn) % 4
            const [cx, cy] = corner
            const rightCell = [
                [cx, cy],
                [cx - 1, cy],
                [cx - 1, cy - 1],
                [cx, cy - 1]
            ][nd]
            const leftCell = [
                [cx, cy - 1],
                [cx, cy],
                [cx - 1, cy],
                [cx - 1, cy - 1]
            ][nd]
            if (at(...rightCell) && !at(...leftCell)) {
                dir = nd
                corner = [cx + steps[nd][0], cy + steps[nd][1]]
                break
            }
        }
    } while (corner[0] !== start[0] || corner[1] !== start[1])
    const simplified = simplify(
        points.map(([px, py]) => [x0 + px / scale, y0 + py / scale]),
        0.1
    )
    return 'M' + simplified.map(([px, py]) => `${px.toFixed(2)} ${py.toFixed(2)}`).join(' L') + ' Z'
}

function simplify(points, tolerance) {
    if (points.length < 3) return points
    const [a, b] = [points[0], points[points.length - 1]]
    let worst = 0
    let index = 0
    for (let i = 1; i < points.length - 1; i++) {
        const p = points[i]
        const d =
            Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) /
            (Math.hypot(b[0] - a[0], b[1] - a[1]) || 1)
        if (d > worst) [worst, index] = [d, i]
    }
    if (worst <= tolerance) return [a, b]
    return [
        ...simplify(points.slice(0, index + 1), tolerance).slice(0, -1),
        ...simplify(points.slice(index), tolerance)
    ]
}

const HOUSE_VIEW = oblique(8.84 / HOUSE.depth, 6.8 / HOUSE.depth)

const pieces = [
    render({
        name: 'house',
        sdf: house,
        view: HOUSE_VIEW,
        grain: houseGrain,
        bounds: [-24, -52, 42, 18]
    }),
    render({ name: 'peg', sdf: peg, view: from(24.8), grain: pegGrain, bounds: [-13, -29, 30, 13] })
]

const browser = await chromium.launch()
try {
    const page = await browser.newPage()
    for (const piece of pieces) {
        const webp = await page.evaluate(
            async ({ width, height, data }) => {
                const canvas = document.createElement('canvas')
                canvas.width = width
                canvas.height = height
                const bytes = Uint8ClampedArray.from(atob(data), (c) => c.charCodeAt(0))
                canvas.getContext('2d').putImageData(new ImageData(bytes, width, height), 0, 0)
                return canvas.toDataURL('image/webp', 0.9).split(',')[1]
            },
            {
                width: piece.width,
                height: piece.height,
                data: Buffer.from(piece.rgba).toString('base64')
            }
        )
        const file = join(IMAGES, `${piece.name}-light.webp`)
        await writeFile(file, Buffer.from(webp, 'base64'))
        console.log(
            `wrote ${file} (${piece.width}×${piece.height}, ${Math.round((webp.length * 3) / 4 / 1024)} KB)`
        )
    }
} finally {
    await browser.close()
}

const lightBox = ({ bounds: [x0, y0, x1, y1] }) =>
    `{ x: ${x0}, y: ${y0}, width: ${x1 - x0}, height: ${y1 - y0} }`
function ringOf({ outline }) {
    const points = [...outline.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => [
        Number(m[1]),
        Number(m[2])
    ])
    const xs = points.map(([x]) => x)
    const ys = points.map(([, y]) => y)
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
    const r = Math.hypot(x1 - x0, y1 - y0) / 2 - 1
    return `{ x: ${((x0 + x1) / 2).toFixed(1)}, y: ${((y0 + y1) / 2).toFixed(1)}, r: ${r.toFixed(1)} }`
}
const [houseSprite, pegSprite] = pieces
const lines = [
    "// Generated by pnpm run render-pieces, in map units with the piece's foot at the origin.",
    '',
    'export type PieceSprite = {',
    '    outline: string',
    '    light: { x: number; y: number; width: number; height: number }',
    '    ring: { x: number; y: number; r: number }',
    '}',
    '',
    'export const HOUSE_SPRITE: PieceSprite = {',
    `    outline: '${houseSprite.outline}',`,
    `    light: ${lightBox(houseSprite)},`,
    `    ring: ${ringOf(houseSprite)}`,
    '}',
    '',
    'export const PEG_SPRITE: PieceSprite = {',
    `    outline: '${pegSprite.outline}',`,
    `    light: ${lightBox(pegSprite)},`,
    `    ring: ${ringOf(pegSprite)}`,
    '}',
    ''
]
await writeFile(join(ROOT, 'src', 'lib', 'board', 'pieceSprites.ts'), lines.join('\n'))
console.log('wrote pieceSprites.ts')
