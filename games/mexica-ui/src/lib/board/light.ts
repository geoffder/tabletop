import type { Box } from './view.js'
import { seededRandom } from './random.js'

export type Vec = [number, number, number]
export type Rgb = [number, number, number]

export const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const scale = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k, a[2] * k]
export const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const normalize = (a: Vec): Vec => scale(a, 1 / Math.hypot(a[0], a[1], a[2]))
export const clamp = (value: number, low = 0, high = 1) => Math.min(high, Math.max(low, value))
export const smoothstep = (from: number, to: number, value: number) => {
    const t = clamp((value - from) / (to - from))
    return t * t * (3 - 2 * t)
}

export function linear(color: string): Rgb {
    const value = parseInt(color.slice(1), 16)
    const channel = (shift: number) => {
        const c = ((value >> shift) & 255) / 255
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    }
    return [channel(16), channel(8), channel(0)]
}

export function srgb(channel: number): number {
    const value = clamp(channel)
    return value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055
}

export function mix(a: Rgb, b: Rgb, t: number): Rgb {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

export type Bitmap = {
    x: number
    y: number
    width: number
    height: number
    data: Uint8ClampedArray
}

// A colour in linear light, and how opaque it is.
export type Paint = { color: Rgb; alpha: number }

export function paint(box: Box, pixels: number, shade: (x: number, y: number) => Paint): Bitmap {
    const width = Math.ceil(box.width * pixels)
    const height = Math.ceil(box.height * pixels)
    const data = new Uint8ClampedArray(width * height * 4)
    for (let row = 0; row < height; row++) {
        for (let column = 0; column < width; column++) {
            const { color, alpha } = shade(
                box.x + (column + 0.5) / pixels,
                box.y + (row + 0.5) / pixels
            )
            const at = (row * width + column) * 4
            data[at] = srgb(color[0]) * 255
            data[at + 1] = srgb(color[1]) * 255
            data[at + 2] = srgb(color[2]) * 255
            data[at + 3] = clamp(alpha) * 255
        }
    }
    return { x: box.x, y: box.y, width, height, data }
}

// Smooth value noise on a lattice, seeded.
export function noise2(seed: number): (x: number, y: number) => number {
    const next = seededRandom(seed)
    const size = 256
    const values = Array.from({ length: size * size }, () => next())
    const at = (x: number, y: number) => values[(y & (size - 1)) * size + (x & (size - 1))]
    const fade = (t: number) => t * t * (3 - 2 * t)
    return (x, y) => {
        const x0 = Math.floor(x)
        const y0 = Math.floor(y)
        const fx = fade(x - x0)
        const fy = fade(y - y0)
        const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * fx
        const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * fx
        return top + (bottom - top) * fy
    }
}

// Noise at a few scales, each half the size and half the strength of the last.
export function fractal(noise: (x: number, y: number) => number, octaves: number) {
    return (x: number, y: number) => {
        let total = 0
        let weight = 1
        let frequency = 1
        let sum = 0
        for (let octave = 0; octave < octaves; octave++) {
            total += noise(x * frequency + octave * 17.3, y * frequency - octave * 9.1) * weight
            sum += weight
            weight /= 2
            frequency *= 2
        }
        return total / sum
    }
}
