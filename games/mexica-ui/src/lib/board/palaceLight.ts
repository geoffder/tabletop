// The Emperor's palace, lit pixel by pixel by marching rays against its blocks: dark slate-grey
// cut stone, walled stairs at the ends of its arms, and on the raised square in the middle a
// bronze sun on a dome of turquoise mosaic, after the Mexica mosaic shields.
// Only scripts/render-looks.mjs runs this, through the /looks page; rerun it after changing the
// palace.
import {
    add,
    type Bitmap,
    clamp,
    dot,
    fractal,
    linear,
    mix,
    noise2,
    normalize,
    type Rgb,
    scale,
    type Vec
} from './light.js'
import { type Coursing, cutStone } from './cutStone.js'
import { PALACE, palaceBounds, palaceParts, type PalacePart } from './palaceShape.js'
import {
    castRays,
    LIGHT,
    normalAt,
    occlusion,
    roundedBox,
    type Scene,
    softShadow
} from './raymarch.js'
import { CELL } from './view.js'

export const PALACE_PIXELS = 3

const STONE = {
    light: linear('#a1a6ad'),
    dark: linear('#646a73'),
    joint: linear('#3f434a'),
    warm: linear('#a59d92'),
    cool: linear('#8f9aa8')
}
const COURSING: Coursing = { shortest: 10, longest: 16, row: 7, joint: 0.45, round: 0.9 }

const BRONZE = { light: linear('#d6ab5e'), dark: linear('#6b4b22'), shine: 0.35 }
const TURQUOISE = { light: linear('#2fb3ad'), dark: linear('#13706e'), grout: linear('#3a3226') }

const mottle = fractal(noise2(201), 4)
const tesserae = noise2(211)

// The sun disc: a dome on the raised square, its sun standing `relief` proud of it.
const DISC = {
    ...PALACE.emblem,
    base: PALACE.rise + PALACE.centre.rise + PALACE.centre.above,
    round: 0.4
}

function domeTop(r: number): number {
    return DISC.base + DISC.depth + DISC.dome * clamp(1 - (r / DISC.radius) ** 2)
}

function disc(p: Vec): number {
    const r = Math.hypot(p[0], p[1])
    const side = r - DISC.radius + DISC.round
    const top = (p[2] - domeTop(r)) * 0.9 + DISC.round
    const outside = Math.hypot(Math.max(side, 0), Math.max(top, 0))
    return Math.max(outside + Math.min(Math.max(side, top), 0) - DISC.round, DISC.base - 0.3 - p[2])
}

// The sun on the disc, after the Sun Stone: a rim, a ring round a boss, eight rays between them
// and a dot between each pair; how far the point lies outside it, below zero inside.
function sun(x: number, y: number): number {
    const r = Math.hypot(x, y)
    const rim = Math.abs(r - 9.7) - 0.6
    const ring = Math.abs(r - 4.2) - 0.42
    const boss = r - 1.9
    const eighth = Math.PI / 4
    const angle = Math.atan2(y, x)
    const toRay = angle - Math.round(angle / eighth) * eighth
    const along = r * Math.cos(toRay)
    const across = Math.abs(r * Math.sin(toRay))
    const ray = Math.max(4.4 - along, along - 8.7, across - 1.05 * ((8.7 - along) / 4.3))
    const toDot = angle - (Math.round(angle / eighth - 0.5) + 0.5) * eighth
    const dotAt = Math.hypot(r * Math.cos(toDot) - 7.4, r * Math.sin(toDot)) - 0.6
    return Math.min(rim, ring, boss, ray, dotAt)
}

function sunRelief(p: Vec): number {
    const r = Math.hypot(p[0], p[1])
    if (r > DISC.radius) return Infinity
    const round = 0.22
    const across = sun(p[0], p[1]) + round
    const floor = domeTop(r)
    const up = Math.abs(p[2] - (floor + DISC.relief / 2 - 0.3)) - (DISC.relief / 2 + 0.3 - round)
    return (
        Math.hypot(Math.max(across, 0), Math.max(up, 0)) + Math.min(Math.max(across, up), 0) - round
    )
}

// The low sloping walls flanking each stair, as on the temples of Tenochtitlan.
const WALL = { width: 3.2, above: 0.8, foot: 1.6 }
const SIDE = CELL / 2 - PALACE.inset
const REACH = 1.5 * CELL - PALACE.inset

function stairWalls(p: Vec): number {
    const arms: [number, number][] = [
        [p[0], p[1]],
        [-p[0], p[1]],
        [p[1], p[0]],
        [-p[1], p[0]]
    ]
    const start = PALACE.flat - 1
    const top = PALACE.rise + WALL.above
    const slope = (top - WALL.foot) / (REACH - start)
    let distance = Infinity
    for (const [along, across] of arms) {
        if (along < start - 4) continue
        const box = roundedBox(
            [along, Math.abs(across), p[2]],
            { x0: start, x1: REACH, y0: SIDE - WALL.width, y1: SIDE, z0: 0, z1: top },
            0.5
        )
        const plane = (p[2] - (top - slope * (along - start))) / Math.hypot(1, slope)
        distance = Math.min(distance, Math.max(box, plane))
    }
    return distance
}

type Hit = { distance: number; part?: PalacePart; kind: 'stone' | 'disc' | 'relief' | 'wall' }

function lit(p: Vec, normal: Vec, bent: Vec, scene: Scene): number {
    const sunLight = clamp(dot(bent, LIGHT)) * (0.35 + 0.65 * softShadow(p, normal, scene))
    const sky = 0.12 * Math.max(0, bent[1]) + 0.1 * Math.max(0, bent[2])
    return (0.4 + 0.6 * sunLight + sky) * occlusion(p, normal, scene)
}

function stoneColor(cut: { tone: number; hue: number; joint: number }): Rgb {
    const body = mix(STONE.light, STONE.dark, clamp(cut.tone))
    const cast = mix(body, cut.hue > 0 ? STONE.warm : STONE.cool, Math.abs(cut.hue))
    return mix(cast, STONE.joint, cut.joint)
}

// Turquoise laid as a mosaic of small irregular tesserae in dark grout.
function mosaic(x: number, y: number): { color: Rgb; grout: number } {
    const size = 1.25
    const u = x / size + (tesserae(x * 0.4, y * 0.4) - 0.5) * 0.5
    const v = y / size + (tesserae(y * 0.4 + 9, x * 0.4) - 0.5) * 0.5
    const fu = u - Math.floor(u)
    const fv = v - Math.floor(v)
    const edge = Math.min(fu, 1 - fu, fv, 1 - fv)
    const shade = tesserae(Math.floor(u) * 3.1, Math.floor(v) * 2.7)
    return {
        color: mix(TURQUOISE.light, TURQUOISE.dark, shade * 0.7),
        grout: clamp(1 - edge / 0.09)
    }
}

export function renderPalace(tilt: number, pixels = PALACE_PIXELS): Bitmap {
    const parts = palaceParts()
    const nearest = (p: Vec): Hit => {
        let hit: Hit = { distance: disc(p), kind: 'disc' }
        const relief = sunRelief(p)
        if (relief < hit.distance) hit = { distance: relief, kind: 'relief' }
        const wall = stairWalls(p)
        if (wall < hit.distance) hit = { distance: wall, kind: 'wall' }
        for (const part of parts) {
            const d = roundedBox(p, part.block, part.round)
            if (d < hit.distance) hit = { distance: d, part, kind: 'stone' }
        }
        return hit
    }
    const scene: Scene = (p) => nearest(p).distance
    const toward: Vec = [0, Math.sqrt(1 - tilt * tilt), tilt]
    const half = normalize(add(LIGHT, toward))
    return castRays(palaceBounds(tilt), tilt, pixels, scene, (p) => {
        const normal = normalAt(p, scene)
        const hit = nearest(p)
        const metal = (color: Rgb, shine: number) => {
            const glint = shine * clamp(dot(normal, half)) ** 18
            return add(scale(color, lit(p, normal, normal, scene)), [
                glint,
                glint * 0.9,
                glint * 0.7
            ])
        }
        const tone = (mottle(p[0] * 0.5, p[1] * 0.5) - 0.5) * 0.4
        if (hit.kind === 'relief' || hit.kind === 'disc') {
            if (hit.kind === 'relief' || sunRelief(p) < 0.05) {
                const color = mix(BRONZE.light, BRONZE.dark, clamp(0.3 + tone))
                return [{ color: metal(color, BRONZE.shine), alpha: 1 }]
            }
            const tile = mosaic(p[0], p[1])
            const color = mix(tile.color, TURQUOISE.grout, tile.grout * 0.8)
            return [{ color: metal(color, 0.1 * (1 - tile.grout)), alpha: 1 }]
        }
        if (hit.kind === 'wall') {
            const color = mix(STONE.light, STONE.dark, clamp(0.4 + tone))
            return [{ color: scale(color, lit(p, normal, normal, scene)), alpha: 1 }]
        }
        const part = hit.part
        if (part === undefined) return [{ color: [0, 0, 0], alpha: 0 }]
        const stair = part.material === 'stair'
        const cut = cutStone(p, normal, part.block, parts.indexOf(part), COURSING)
        const bent = cut === undefined ? normal : normalize(add(normal, cut.tip))
        let color = cut === undefined ? mix(STONE.light, STONE.dark, 0.4) : stoneColor(cut)
        // Each step's tread paler and its riser in shade, so the stair reads.
        if (stair) color = normal[2] > 0.7 ? mix(color, STONE.light, 0.3) : scale(color, 0.72)
        return [{ color: scale(color, lit(p, normal, bent, scene)), alpha: 1 }]
    }).bitmaps[0]
}
