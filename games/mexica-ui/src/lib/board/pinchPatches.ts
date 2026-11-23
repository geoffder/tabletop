import { LAND_CELLS } from '@tabletop/mexica'
import type { Bitmap } from './light.js'
import {
    PINCH_CORNERS,
    PINCH_FEATHER,
    PINCH_REACH,
    PINCH_SHEET,
    type PinchCorner,
    pinchBox,
    pinchFrame
} from './pinches.js'
import {
    PAVING,
    renderLake,
    renderPaving,
    renderShore,
    TURQUOISE,
    withPinch
} from './surfaceTexture.js'
import { waterworks } from './waterworks.js'

// The sheet of pinch patches the board lays over a pinch's corner (pinches.ts): each the lake,
// and over it the shore and paving within the land as the board clips them with the square
// across dug, all with the coast drawn back from the corner, fading in from the patch's edge.
export function renderPinchSheet(pixels: number): Bitmap {
    const width = Math.ceil(PINCH_SHEET.width * pixels)
    const height = Math.ceil(PINCH_SHEET.height * pixels)
    const data = new Uint8ClampedArray(width * height * 4)
    for (const corner of PINCH_CORNERS) {
        const patch = renderPatch(corner, pixels)
        const frame = pinchFrame(corner)
        const left = Math.round(frame.x * pixels)
        const top = Math.round(frame.y * pixels)
        for (let row = 0; row < patch.height; row++) {
            const from = row * patch.width * 4
            data.set(
                patch.data.subarray(from, from + patch.width * 4),
                ((top + row) * width + left) * 4
            )
        }
    }
    return { x: 0, y: 0, width, height, data }
}

function renderPatch(corner: PinchCorner, pixels: number): Bitmap {
    const box = pinchBox(corner)
    const [lake, shore, paving] = withPinch(corner.at, () => [
        renderLake(TURQUOISE, pixels, box),
        renderShore(pixels, box),
        renderPaving(PAVING, pixels, box)
    ])
    const zones = waterworks(LAND_CELLS, new Set([corner.across])).zones.map((zone) =>
        zone.points.split(' ').map((pair): [number, number] => {
            const [x, y] = pair.split(',').map(Number)
            return [x, y]
        })
    )
    const inLand = (x: number, y: number) => zones.some((zone) => inside(zone, x, y))
    const data = new Uint8ClampedArray(lake.data.length)
    for (let row = 0; row < lake.height; row++) {
        for (let column = 0; column < lake.width; column++) {
            const x = box.x + (column + 0.5) / pixels
            const y = box.y + (row + 0.5) / pixels
            const at = (row * lake.width + column) * 4
            const land = inLand(x, y) ? 1 : 0
            const color = [0, 1, 2].map((channel) => lake.data[at + channel])
            for (const layer of [shore, paving]) {
                const alpha = (layer.data[at + 3] / 255) * land
                for (const channel of [0, 1, 2]) {
                    color[channel] = layer.data[at + channel] * alpha + color[channel] * (1 - alpha)
                }
            }
            const edge =
                PINCH_REACH - Math.max(Math.abs(x - corner.at.x), Math.abs(y - corner.at.y))
            const fade = Math.min(1, Math.max(0, edge / PINCH_FEATHER))
            data[at] = color[0]
            data[at + 1] = color[1]
            data[at + 2] = color[2]
            data[at + 3] = fade * 255
        }
    }
    return { x: box.x, y: box.y, width: lake.width, height: lake.height, data }
}

// Whether a point lies inside a polygon, by the crossings of a ray to its right.
function inside(polygon: readonly [number, number][], x: number, y: number): boolean {
    let crossings = false
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [xi, yi] = polygon[i]
        const [xj, yj] = polygon[j]
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) crossings = !crossings
    }
    return crossings
}
