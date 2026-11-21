// A wooden bridge, lit pixel by pixel by marching rays against its parts.
// Only scripts/render-looks.mjs runs this, through the /looks page; rerun it after changing the
// bridge or its wood.
import { Axis } from '@tabletop/mexica'
import {
    type Bitmap,
    clamp,
    dot,
    fractal,
    linear,
    mix,
    noise2,
    type Rgb,
    scale,
    type Vec
} from './light.js'
import { seededRandom } from './random.js'
import { bridgeBounds, bridgeParts, type Part, type Material } from './bridgeShape.js'
import { castRays, LIGHT, normalAt, occlusion, type Scene, softShadow } from './raymarch.js'

export const BRIDGE_PIXELS = 3

type Wood = { light: Rgb; dark: Rgb; joint: Rgb }

const WOODS: Record<Material, Wood> = {
    deck: { light: linear('#b8956a'), dark: linear('#73523a'), joint: linear('#33241a') },
    timber: { light: linear('#a17d55'), dark: linear('#5f422b'), joint: linear('#2e2016') }
}

const PLANK = { pitch: 3.1, gap: 0.35 }

const grain = fractal(noise2(151), 3)
const streaks = noise2(157)

export function renderBridge(screenAxis: Axis, tilt: number, pixels = BRIDGE_PIXELS): Bitmap {
    const parts = bridgeParts()
    const local = (p: Vec): Vec =>
        screenAxis === Axis.EastWest ? [p[0], p[1], p[2]] : [p[1], p[0], p[2]]
    const nearest = (p: Vec): { distance: number; part: Part } => {
        const [a, c, z] = local(p)
        let part = parts[0]
        let distance = Infinity
        for (const candidate of parts) {
            const d = candidate.distance(a, c, z)
            if (d < distance) {
                distance = d
                part = candidate
            }
        }
        return { distance, part }
    }
    const scene: Scene = (p) => nearest(p).distance
    const box = bridgeBounds(screenAxis, tilt)
    return castRays(box, tilt, pixels, scene, (p) => [
        { color: shade(p, local(p), nearest(p).part, scene), alpha: 1 }
    ]).bitmaps[0]
}

function shade(p: Vec, [a, c, z]: Vec, part: Part, scene: Scene): Rgb {
    const normal = normalAt(p, scene)
    const base = colorAt(a, c, z, part)
    const sun = clamp(dot(normal, LIGHT)) * (0.35 + 0.65 * softShadow(p, normal, scene))
    const sky = 0.12 * Math.max(0, normal[1]) + 0.1 * Math.max(0, normal[2])
    return scale(base, (0.4 + 0.6 * sun + sky) * occlusion(p, normal, scene))
}

// Wood with its grain along its length, darker in the joints between planks.
function colorAt(a: number, c: number, z: number, part: Part): Rgb {
    const wood = WOODS[part.material]
    const [length, side] = part.grain === 'along' ? [a, c + z] : [c, a + z * 0.3]
    let tone = 0.35
    let joint = 0
    if (part.material === 'deck') {
        const index = Math.floor((a + 100) / PLANK.pitch)
        const into = a + 100 - index * PLANK.pitch
        const toEdge = Math.min(into, PLANK.pitch - into)
        joint = clamp(1 - (toEdge - PLANK.gap / 2) / 0.25)
        tone = 0.15 + seededRandom(index * 7919 + 3)() * 0.45
    }
    const lines = grain(length * 0.12, side * 2.4)
    const streak = streaks(length * 0.05, side * 0.8)
    const shadeOf = clamp(tone + (lines - 0.5) * 0.7 + (streak - 0.5) * 0.25)
    return mix(mix(wood.light, wood.dark, shadeOf), wood.joint, joint * 0.85)
}
