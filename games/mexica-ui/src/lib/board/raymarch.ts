// Lighting shared by the pieces drawn by marching rays against distance fields.
import { add, type Bitmap, clamp, normalize, type Rgb, scale, srgb, type Vec } from './light.js'
import type { Block } from './templeShape.js'
import type { Box } from './view.js'

// From above, to the left and beyond the board, as the paving's light.
export const LIGHT: Vec = normalize([-0.5, -0.45, 0.74])
export const SUPERSAMPLE = 3
export const FAR = 160
const HIT = 0.004

export type Scene = (p: Vec) => number

export function roundedBox(p: Vec, block: Block, round: number): number {
    const qx = Math.abs(p[0] - (block.x0 + block.x1) / 2) - ((block.x1 - block.x0) / 2 - round)
    const qy = Math.abs(p[1] - (block.y0 + block.y1) / 2) - ((block.y1 - block.y0) / 2 - round)
    const qz = Math.abs(p[2] - (block.z0 + block.z1) / 2) - ((block.z1 - block.z0) / 2 - round)
    const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0))
    return outside + Math.min(Math.max(qx, qy, qz), 0) - round
}

export function march(from: Vec, direction: Vec, scene: Scene): Vec | undefined {
    let travelled = 0
    for (let step = 0; step < 200 && travelled < FAR; step++) {
        const p = add(from, scale(direction, travelled))
        if (p[2] < -0.01) return undefined
        const d = scene(p)
        if (d < HIT) return p
        travelled += d
    }
    return undefined
}

export function normalAt(p: Vec, scene: Scene): Vec {
    const e = 0.01
    return normalize([
        scene([p[0] + e, p[1], p[2]]) - scene([p[0] - e, p[1], p[2]]),
        scene([p[0], p[1] + e, p[2]]) - scene([p[0], p[1] - e, p[2]]),
        scene([p[0], p[1], p[2] + e]) - scene([p[0], p[1], p[2] - e])
    ])
}

export function occlusion(p: Vec, normal: Vec, scene: Scene): number {
    let shade = 0
    let weight = 1
    for (let step = 1; step <= 5; step++) {
        const reach = step * 0.9
        shade += weight * (reach - scene(add(p, scale(normal, reach))))
        weight *= 0.55
    }
    return clamp(1 - shade * 0.2)
}

export function softShadow(p: Vec, normal: Vec, scene: Scene): number {
    let light = 1
    let travelled = 0.15
    const from = add(p, scale(normal, 0.05))
    for (let step = 0; step < 48 && travelled < 60; step++) {
        const d = scene(add(from, scale(LIGHT, travelled)))
        if (d < 0.001) return 0
        light = Math.min(light, (6 * d) / travelled)
        travelled += Math.max(d, 0.08)
    }
    return clamp(light)
}

// What a ray shows where it meets the piece: a colour in the space `encode` takes to bytes,
// and how opaque it is.
export type Sample = { color: Rgb; alpha: number }

// Which of the supersamples met the piece, row by row, `columns` to a row.
export type Hits = { columns: number; rows: number; at: Uint8Array }

// Seen at `tilt`, `pixels` to a board unit, in as many layers as `shade` gives samples: each
// pixel of a layer averages its supersamples' colours, weighted by how opaque each is.
export function castRays(
    box: Box,
    tilt: number,
    pixels: number,
    scene: Scene,
    shade: (p: Vec) => Sample[],
    encode: (channel: number) => number = srgb
): { bitmaps: Bitmap[]; hits: Hits } {
    const toward: Vec = [0, Math.sqrt(1 - tilt * tilt), tilt]
    const width = Math.ceil(box.width * pixels)
    const height = Math.ceil(box.height * pixels)
    const layers: Uint8ClampedArray[] = []
    const hits = {
        columns: width * SUPERSAMPLE,
        rows: height * SUPERSAMPLE,
        at: new Uint8Array(width * height * SUPERSAMPLE ** 2)
    }
    for (let row = 0; row < height; row++) {
        for (let column = 0; column < width; column++) {
            const sums: Rgb[] = []
            const covers: number[] = []
            for (let sy = 0; sy < SUPERSAMPLE; sy++) {
                for (let sx = 0; sx < SUPERSAMPLE; sx++) {
                    const px = box.x + (column + (sx + 0.5) / SUPERSAMPLE) / pixels
                    const py = box.y + (row + (sy + 0.5) / SUPERSAMPLE) / pixels
                    // The pixel's ray meets the ground at (px, py / tilt, 0) and runs along
                    // `toward`; start well in front of the piece and march back.
                    const start = add([px, py / tilt, 0], scale(toward, FAR / 2))
                    const point = march(start, scale(toward, -1), scene)
                    if (point === undefined) continue
                    hits.at[(row * SUPERSAMPLE + sy) * hits.columns + column * SUPERSAMPLE + sx] = 1
                    shade(point).forEach(({ color, alpha }, layer) => {
                        sums[layer] = add(sums[layer] ?? [0, 0, 0], scale(color, alpha))
                        covers[layer] = (covers[layer] ?? 0) + alpha
                    })
                }
            }
            covers.forEach((cover, layer) => {
                layers[layer] ??= new Uint8ClampedArray(width * height * 4)
                if (cover === 0) return
                const data = layers[layer]
                const at = (row * width + column) * 4
                const color = scale(sums[layer], 1 / cover)
                data[at] = encode(color[0]) * 255
                data[at + 1] = encode(color[1]) * 255
                data[at + 2] = encode(color[2]) * 255
                data[at + 3] = (cover / SUPERSAMPLE ** 2) * 255
            })
        }
    }
    const bitmaps = layers.map((data) => ({ x: box.x, y: box.y, width, height, data }))
    return { bitmaps, hits }
}

type Flat = [number, number]

// The outline of what the rays met, as a path in board units to fill even-odd: marching squares
// over the supersamples, each loop with points closer than most of a supersample to the
// line through its neighbours dropped.
export function outlineOf(hits: Hits, box: Box, pixels: number): string {
    const unit = 1 / (pixels * SUPERSAMPLE)
    const inside = (column: number, row: number) =>
        column >= 0 &&
        row >= 0 &&
        column < hits.columns &&
        row < hits.rows &&
        hits.at[row * hits.columns + column] === 1
    // Crossings on the grid's edges, keyed by doubled coordinates so each is exact.
    const next = new Map<string, string>()
    const place = new Map<string, Flat>()
    const link = (from: Flat, to: Flat) => {
        const key = (point: Flat) => {
            const name = `${point[0] * 2},${point[1] * 2}`
            place.set(name, point)
            return name
        }
        next.set(key(from), key(to))
    }
    for (let row = -1; row < hits.rows; row++) {
        for (let column = -1; column < hits.columns; column++) {
            // Corners of the square between four samples, clockwise from the top left.
            const a = inside(column, row)
            const b = inside(column + 1, row)
            const c = inside(column + 1, row + 1)
            const d = inside(column, row + 1)
            const top: Flat = [column + 0.5, row]
            const right: Flat = [column + 1, row + 0.5]
            const bottom: Flat = [column + 0.5, row + 1]
            const left: Flat = [column, row + 0.5]
            // Every crossing runs the same way round the inside, joining head to tail; touching
            // corners stay apart.
            const code = (a ? 8 : 0) | (b ? 4 : 0) | (c ? 2 : 0) | (d ? 1 : 0)
            switch (code) {
                case 1:
                    link(bottom, left)
                    break
                case 2:
                    link(right, bottom)
                    break
                case 3:
                    link(right, left)
                    break
                case 4:
                    link(top, right)
                    break
                case 5:
                    link(top, right)
                    link(bottom, left)
                    break
                case 6:
                    link(top, bottom)
                    break
                case 7:
                    link(top, left)
                    break
                case 8:
                    link(left, top)
                    break
                case 9:
                    link(bottom, top)
                    break
                case 10:
                    link(left, top)
                    link(right, bottom)
                    break
                case 11:
                    link(right, top)
                    break
                case 12:
                    link(left, right)
                    break
                case 13:
                    link(bottom, right)
                    break
                case 14:
                    link(left, bottom)
                    break
            }
        }
    }
    const text = (n: number) => String(Math.round(n * 100) / 100)
    const loops: string[] = []
    for (const start of [...next.keys()]) {
        if (!next.has(start)) continue
        const ring: Flat[] = []
        let at: string | undefined = start
        while (at !== undefined && next.has(at)) {
            const [column, row] = place.get(at) ?? [0, 0]
            // Samples sit at the middles of their supersamples.
            ring.push([box.x + (column + 0.5) * unit, box.y + (row + 0.5) * unit])
            const after: string | undefined = next.get(at)
            next.delete(at)
            at = after
        }
        if (ring.length < 3) continue
        // Split at the point farthest from the start, since a closed loop's ends meet.
        const far = ring.reduce(
            (best, point, index) =>
                Math.hypot(point[0] - ring[0][0], point[1] - ring[0][1]) >
                Math.hypot(ring[best][0] - ring[0][0], ring[best][1] - ring[0][1])
                    ? index
                    : best,
            0
        )
        const kept = [
            ...simplify(ring.slice(0, far + 1), unit * 0.7).slice(0, -1),
            ...simplify([...ring.slice(far), ring[0]], unit * 0.7).slice(0, -1)
        ]
        loops.push(
            kept.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${text(x)} ${text(y)}`).join('') + 'Z'
        )
    }
    return loops.join('')
}

// Ramer–Douglas–Peucker: drops the points within `tolerance` of the line past them.
function simplify(points: readonly [number, number][], tolerance: number): [number, number][] {
    if (points.length < 3) return [...points]
    const [ax, ay] = points[0]
    const [bx, by] = points[points.length - 1]
    const length = Math.hypot(bx - ax, by - ay) || 1
    let farthest = 0
    let index = 0
    for (let i = 1; i < points.length - 1; i++) {
        const [px, py] = points[i]
        const distance = Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / length
        if (distance > farthest) {
            farthest = distance
            index = i
        }
    }
    if (farthest <= tolerance) return [points[0], points[points.length - 1]]
    return [
        ...simplify(points.slice(0, index + 1), tolerance).slice(0, -1),
        ...simplify(points.slice(index), tolerance)
    ]
}
