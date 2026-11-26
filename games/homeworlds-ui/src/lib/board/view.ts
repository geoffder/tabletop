import type { Point } from '@tabletop/common'

// A point in the table's space: x to the right, y away from the viewer, z up from the table.
export type Vec3 = readonly [number, number, number]

// The table seen from its near side, as the GIPF project titles are, or from straight above.
export const TILT = 0.75

export type BoardView = {
    readonly flat: boolean
    // How much a distance across the table shrinks on screen.
    readonly tilt: number
    // How much a height above the table shows on screen.
    readonly rise: number
    // Towards the viewer, for telling which faces of a piece face them.
    readonly toViewer: Vec3
}

function makeBoardView(tilt: number, flat: boolean): BoardView {
    const rise = Math.sqrt(1 - tilt * tilt)
    return { flat, tilt, rise, toViewer: [0, -rise, tilt] }
}

export const TILTED_VIEW = makeBoardView(TILT, false)
export const FLAT_VIEW = makeBoardView(1, true)

export function boardView(flat: boolean): BoardView {
    return flat ? FLAT_VIEW : TILTED_VIEW
}

export function project(view: BoardView, [x, y, z]: Vec3): Point {
    return { x, y: -(y * view.tilt + z * view.rise) }
}

// A spot on the table, seen on screen.
export function onTable(view: BoardView, x: number, y: number): Point {
    return { x, y: -y * view.tilt }
}

export function dot(a: Vec3, b: Vec3): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

export function sub(a: Vec3, b: Vec3): Vec3 {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

export function add(a: Vec3, b: Vec3): Vec3 {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

export function scale(a: Vec3, factor: number): Vec3 {
    return [a[0] * factor, a[1] * factor, a[2] * factor]
}

export function cross(a: Vec3, b: Vec3): Vec3 {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

export function normalize(a: Vec3): Vec3 {
    const length = Math.hypot(a[0], a[1], a[2])
    return scale(a, 1 / length)
}
