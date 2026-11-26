import { PyramidColor, PyramidSize } from '@tabletop/homeworlds'
import type { Point } from '@tabletop/common'
import { hull } from './hull.js'
import {
    add,
    type BoardView,
    cross,
    dot,
    normalize,
    project,
    scale,
    sub,
    type Vec3
} from './view.js'

// Looney Pyramids in table units (half a millimetre): a square base and a height, Small, Medium
// and Large nesting inside one another.
export const PYRAMID_BASE: Record<PyramidSize, number> = {
    [PyramidSize.Small]: 28.6,
    [PyramidSize.Medium]: 39.6,
    [PyramidSize.Large]: 50.8
}

export const PYRAMID_HEIGHT: Record<PyramidSize, number> = {
    [PyramidSize.Small]: 50.8,
    [PyramidSize.Medium]: 69.8,
    [PyramidSize.Large]: 89
}

// Standing as a star, turned about its upright axis; or lying on a face as a ship, its tip
// pointing `heading` radians round from straight away from the viewer.
export type PyramidPose =
    { kind: 'star'; yaw: number; lift: number } | { kind: 'ship'; heading: number }

export function slantHeight(size: PyramidSize): number {
    return Math.hypot(PYRAMID_HEIGHT[size], PYRAMID_BASE[size] / 2)
}

// How far a lying ship reaches across the table and away, pointing `heading` round.
export function shipFootprint(
    size: PyramidSize,
    heading: number
): { across: number; deep: number } {
    const length = slantHeight(size)
    const width = PYRAMID_BASE[size]
    const sin = Math.abs(Math.sin(heading))
    const cos = Math.abs(Math.cos(heading))
    return { across: length * sin + width * cos, deep: length * cos + width * sin }
}

type Solid = { base: [Vec3, Vec3, Vec3, Vec3]; apex: Vec3 }

function turn([x, y, z]: Vec3, angle: number): Vec3 {
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    return [x * cos - y * sin, x * sin + y * cos, z]
}

// The corners about the piece's footprint centre on the table.
export function solid(size: PyramidSize, pose: PyramidPose): Solid {
    const half = PYRAMID_BASE[size] / 2
    const height = PYRAMID_HEIGHT[size]
    if (pose.kind === 'star') {
        const corners: [Vec3, Vec3, Vec3, Vec3] = [
            [-half, -half, pose.lift],
            [half, -half, pose.lift],
            [half, half, pose.lift],
            [-half, half, pose.lift]
        ]
        return {
            base: [
                turn(corners[0], pose.yaw),
                turn(corners[1], pose.yaw),
                turn(corners[2], pose.yaw),
                turn(corners[3], pose.yaw)
            ],
            apex: [0, 0, height + pose.lift]
        }
    }
    // Lying on a face: that face's base edge on the table at the back, the tip ahead on the
    // table, and the open base standing up from the back edge, leaning forward as the face's
    // slope leans.
    const slant = slantHeight(size)
    const base = PYRAMID_BASE[size]
    const slope = Math.atan2(height, half)
    const back = -slant / 2
    const lean = base * Math.cos(slope)
    const top = base * Math.sin(slope)
    const corners: [Vec3, Vec3, Vec3, Vec3] = [
        [-half, back, 0],
        [half, back, 0],
        [half, back + lean, top],
        [-half, back + lean, top]
    ]
    return {
        base: [
            turn(corners[0], -pose.heading),
            turn(corners[1], -pose.heading),
            turn(corners[2], -pose.heading),
            turn(corners[3], -pose.heading)
        ],
        apex: turn([0, slant / 2, 0], -pose.heading)
    }
}

type Rgb = readonly [number, number, number]

// The translucent plastic: the colour light takes through it, its deep tone where the plastic is
// thick, and how light its lit faces get.
const PLASTIC: Record<PyramidColor, { body: Rgb; deep: Rgb; lit: Rgb }> = {
    [PyramidColor.Red]: { body: [232, 34, 30], deep: [138, 8, 16], lit: [255, 128, 104] },
    [PyramidColor.Yellow]: { body: [250, 208, 22], deep: [184, 124, 4], lit: [255, 244, 150] },
    [PyramidColor.Green]: { body: [30, 176, 62], deep: [6, 98, 34], lit: [128, 232, 130] },
    [PyramidColor.Blue]: { body: [52, 56, 214], deep: [22, 16, 128], lit: [128, 140, 255] }
}

const LIGHT: Vec3 = normalize([-0.5, 0.35, 0.8])

function mix(a: Rgb, b: Rgb, amount: number): Rgb {
    const blend = (from: number, to: number) => from + (to - from) * amount
    return [blend(a[0], b[0]), blend(a[1], b[1]), blend(a[2], b[2])]
}

function css([r, g, b]: Rgb): string {
    return `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)})`
}

// A face lit by how squarely it meets the light, from the plastic's deep tone up to its lit one.
function faceColor(color: PyramidColor, normal: Vec3): string {
    const plastic = PLASTIC[color]
    const light = Math.max(0, dot(normal, LIGHT))
    return light > 0.55
        ? css(mix(plastic.body, plastic.lit, (light - 0.55) / 0.45))
        : css(mix(plastic.deep, plastic.body, light / 0.55))
}

// The lit tone washed nearly white, for the pips.
export function plasticColor(color: PyramidColor, tone: 'body' | 'deep' | 'lit' | 'pale'): string {
    const plastic = PLASTIC[color]
    return css(tone === 'pale' ? mix(plastic.lit, [255, 255, 255], 0.6) : plastic[tone])
}

export type Face = { points: string; fill: string; facing: boolean }
// A pip as a unit circle mapped onto the face, with its centre and largest radius on screen.
export type Pip = { transform: string; x: number; y: number; r: number }

export type PyramidDrawing = {
    // Faces turned away first, seen through the ones facing the viewer.
    faces: Face[]
    // The plastic's edges, thicker and so deeper in colour.
    edges: { d: string; facing: boolean }[]
    // The size's dots near the base of each face turned to the viewer, as unit circles mapped
    // onto the face.
    pips: Pip[]
    // The inside of the hollow, its faces seen through the walls.
    inner: Face[]
    // The thick rim round the open base, between the outer and inner edges.
    rim: string
    // The open base, where it faces the viewer: a lying ship pointing away shows its hollow.
    mouth?: string
    // The shadow the piece casts on the table, light coloured by the plastic.
    shadow: string
    // The outline on screen, for hit areas.
    outline: string
}

function pointsOf(points: readonly Point[]): string {
    return points.map(({ x, y }) => `${round(x)},${round(y)}`).join(' ')
}

function round(value: number): number {
    return Math.round(value * 100) / 100
}

const PIP_LEAST_ROUNDNESS = 0.6
// Faces turned further from the viewer than this show no pips, unless no face is turned nearer.
const PIP_LEAST_FACING = 0.3

// A unit circle mapped by the columns (ax, ay) and (bx, by), as an ellipse no flatter than
// PIP_LEAST_ROUNDNESS: a face seen slantwise squashes its dots to dashes, which no longer read
// as dots. The ellipse's axes come from the mapping's singular values.
function roundedDot(ax: number, ay: number, bx: number, by: number, at: Point): Pip {
    const e = (ax + by) / 2
    const f = (ax - by) / 2
    const g = (ay + bx) / 2
    const h = (ay - bx) / 2
    const q = Math.hypot(e, h)
    const r = Math.hypot(f, g)
    const major = q + r
    const minor = Math.max(Math.abs(q - r), major * PIP_LEAST_ROUNDNESS)
    const angle = (Math.atan2(g, f) + Math.atan2(h, e)) / 2
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    return {
        transform: `matrix(${round(cos * major)} ${round(sin * major)} ${round(-sin * minor)} ${round(cos * minor)} ${round(at.x)} ${round(at.y)})`,
        x: round(at.x),
        y: round(at.y),
        r: round(major)
    }
}

// The pip count of each size, in a row near the base of every face.
function pipsOn(view: BoardView, size: PyramidSize, from: Vec3, to: Vec3, apex: Vec3): Pip[] {
    const length = Math.hypot(...sub(to, from))
    const along = normalize(sub(to, from))
    const middle = scale(add(from, to), 0.5)
    const up = normalize(sub(apex, middle))
    const normal = cross(along, up)
    const base = PYRAMID_BASE[size]
    // Larger than the moulded dots, and clear of the thick rim along the base, to read at a
    // glance on a lying ship as on a star.
    const radius = base * 0.072
    const spacing = base * 0.185
    // In a row along the base, off towards one corner of each face, as on the pieces.
    const first = length * 0.76 - spacing * (size - 1)
    return Array.from({ length: size }, (_, index) => {
        const centre = add(
            add(add(from, scale(along, first + index * spacing)), scale(up, base * 0.22)),
            scale(normal, 0.4)
        )
        const c = project(view, centre)
        const a = project(view, add(centre, scale(along, radius)))
        const b = project(view, add(centre, scale(up, radius)))
        return roundedDot(a.x - c.x, a.y - c.y, b.x - c.x, b.y - c.y, c)
    })
}

// The plastic is thick: about a tenth of the base, so edges and the base's rim show as bands.
const WALL_SHARE = 0.1

// The hollow inside, the solid shrunk about its insphere's centre so the walls are equally thick.
function hollowOf(size: PyramidSize, { base, apex }: Solid): Solid {
    const half = PYRAMID_BASE[size] / 2
    const height = PYRAMID_HEIGHT[size]
    const slant = Math.hypot(height, half)
    const volume = (4 * half * half * height) / 3
    const surface = 4 * half * half + 4 * half * slant
    const inradius = (3 * volume) / surface
    const shrink = 1 - (PYRAMID_BASE[size] * WALL_SHARE) / inradius
    const middle = scale(add(add(base[0], base[1]), add(base[2], base[3])), 0.25)
    const centre = add(middle, scale(sub(apex, middle), inradius / height))
    const toward = (corner: Vec3) => add(centre, scale(sub(corner, centre), shrink))
    return {
        base: [toward(base[0]), toward(base[1]), toward(base[2]), toward(base[3])],
        apex: toward(apex)
    }
}

export function drawPyramid(
    view: BoardView,
    color: PyramidColor,
    size: PyramidSize,
    pose: PyramidPose
): PyramidDrawing {
    const outer = solid(size, pose)
    const { base, apex } = outer
    const hollow = hollowOf(size, outer)
    const centre = scale(add(add(base[0], base[1]), add(base[2], base[3])), 0.25)
    const sides = base.map((from, index) => {
        const to = base[(index + 1) % base.length]
        let normal = normalize(cross(sub(to, from), sub(apex, from)))
        // Outward, away from the base's middle.
        if (dot(normal, sub(from, centre)) < 0) normal = scale(normal, -1)
        return { from, to, normal, facing: dot(normal, view.toViewer) > 0 }
    })
    const faces: Face[] = sides
        .map((side) => ({
            points: pointsOf([side.from, side.to, apex].map((corner) => project(view, corner))),
            // A face seen from inside shows its inner side, lit from the other way.
            fill: faceColor(color, side.facing ? side.normal : scale(side.normal, -1)),
            facing: side.facing
        }))
        .toSorted((a, b) => Number(a.facing) - Number(b.facing))
    const line = (a: Vec3, b: Vec3) => {
        const p = project(view, a)
        const q = project(view, b)
        return `M${round(p.x)} ${round(p.y)}L${round(q.x)} ${round(q.y)}`
    }
    const edges = [
        ...sides.map((side, index) => ({
            d: line(side.from, apex),
            facing: side.facing || (sides.at(index - 1)?.facing ?? false)
        })),
        ...sides.map((side) => ({ d: line(side.from, side.to), facing: side.facing }))
    ].toSorted((a, b) => Number(a.facing) - Number(b.facing))
    // Pips on the faces turned well towards the viewer: one seen nearly edge on would only
    // smear them along its edge.
    const toViewer = normalize(view.toViewer)
    const facingBy = sides.map((side) => dot(side.normal, toViewer))
    const most = Math.max(...facingBy)
    const pips = sides
        .filter((_, index) => {
            const facing = facingBy[index] ?? 0
            return facing > 0 && (facing >= PIP_LEAST_FACING || facing === most)
        })
        .flatMap((side) => pipsOn(view, size, side.from, side.to, apex))
    const inner: Face[] = hollow.base.map((from, index) => {
        const to = hollow.base[(index + 1) % hollow.base.length]
        const side = sides[index]
        return {
            points: pointsOf([from, to, hollow.apex].map((corner) => project(view, corner))),
            fill: faceColor(color, side ? scale(side.normal, -1) : [0, 0, 1]),
            facing: side?.facing ?? false
        }
    })
    const loop = (corners: readonly Vec3[]) =>
        corners
            .map((corner) => project(view, corner))
            .map((point, index) => `${index === 0 ? 'M' : 'L'}${round(point.x)} ${round(point.y)}`)
            .join('') + 'Z'
    const rim = loop(base) + loop(hollow.base)
    let baseNormal = normalize(cross(sub(base[1], base[0]), sub(base[3], base[0])))
    if (dot(baseNormal, sub(apex, centre)) > 0) baseNormal = scale(baseNormal, -1)
    const mouthFacing = dot(baseNormal, view.toViewer) > 0.05
    const corners = [...base, apex]
    // Cast along the light onto the table.
    const cast = corners.map(([x, y, z]) =>
        project(view, [x - (LIGHT[0] / LIGHT[2]) * z, y - (LIGHT[1] / LIGHT[2]) * z, 0])
    )
    return {
        faces,
        inner,
        rim,
        edges,
        pips,
        ...(mouthFacing
            ? { mouth: pointsOf(hollow.base.map((corner) => project(view, corner))) }
            : {}),
        shadow: pointsOf(hull(cast)),
        outline: pointsOf(hull(corners.map((corner) => project(view, corner))))
    }
}
