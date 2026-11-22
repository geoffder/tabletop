import { Axis } from '@tabletop/mexica'
import { BRIDGE_RISE, CELL, type Box } from './view.js'

// A wooden bridge over its canal cell, in board units round the cell's centre, built along its
// span (a) and across it (c), z up. The deck stands BRIDGE_RISE above the water at the middle,
// where a Pilli Mexica stands on it, and it reaches a little onto the land at both ends: a thick
// plank deck on two stringers, ramped down onto the land, between raised curbs that carry low
// rails.

export const BRIDGE = {
    reach: 0.62 * CELL,
    // Wide enough that a Pilli Mexica's robe stands clear inside the rails.
    half: 0.355 * CELL,
    deck: BRIDGE_RISE * CELL
}

export type Material = 'deck' | 'timber'

// A solid of the bridge: its distance field in its own (a, c, z), the box round it, what it is
// made of, and which way its grain runs.
export type Part = {
    distance: (a: number, c: number, z: number) => number
    bounds: { a0: number; a1: number; c0: number; c1: number; z0: number; z1: number }
    material: Material
    grain: 'along' | 'across'
    // On the bridge's near side when it runs across the screen: drawn over a Pilli Mexica
    // standing on it.
    front?: boolean
}

function box(
    a0: number,
    a1: number,
    c0: number,
    c1: number,
    z0: number,
    z1: number,
    material: Material,
    grain: Part['grain'],
    round = 0.4
): Part {
    return {
        distance: (a, c, z) => {
            const qa = Math.abs(a - (a0 + a1) / 2) - ((a1 - a0) / 2 - round)
            const qc = Math.abs(c - (c0 + c1) / 2) - ((c1 - c0) / 2 - round)
            const qz = Math.abs(z - (z0 + z1) / 2) - ((z1 - z0) / 2 - round)
            const outside = Math.hypot(Math.max(qa, 0), Math.max(qc, 0), Math.max(qz, 0))
            return outside + Math.min(Math.max(qa, qc, qz), 0) - round
        },
        bounds: { a0, a1, c0, c1, z0, z1 },
        material,
        grain
    }
}

// A slab whose top follows `top` along the span, `thickness` deep.
function slab(
    reach: number,
    c0: number,
    c1: number,
    top: (a: number) => number,
    thickness: number,
    material: Material,
    grain: Part['grain']
): Part {
    const highest = Math.max(
        ...Array.from({ length: 41 }, (_, i) => top(-reach + (i / 20) * reach))
    )
    const lowest = Math.min(top(-reach), top(reach))
    return {
        distance: (a, c, z) => {
            const t = top(a)
            const k = 0.6
            return Math.max(
                Math.abs(a) - reach,
                Math.abs(c - (c0 + c1) / 2) - (c1 - c0) / 2,
                (z - t) * k,
                (t - thickness - z) * k
            )
        },
        bounds: { a0: -reach, a1: reach, c0, c1, z0: lowest - thickness, z1: highest },
        material,
        grain
    }
}

export function bridgeParts(): Part[] {
    const { reach, half, deck } = BRIDGE
    const flat = reach - 9
    const thick = 2.2
    const curb = { width: 2.8, above: 1.6, depth: 4.2 }
    const top = (a: number) =>
        Math.abs(a) <= flat ? deck : deck - ((Math.abs(a) - flat) / (reach - flat)) * (deck - 1)
    const sides = [-1, 1]
    const timber = (
        a0: number,
        a1: number,
        c0: number,
        c1: number,
        z0: number,
        z1: number,
        round = 0.35
    ) => box(a0, a1, c0, c1, z0, z1, 'timber', 'along', round)
    const railFoot = deck + curb.above
    const railAt = half - 1
    const posts = [-flat + 1, -5, 5, flat - 1].flatMap((a) =>
        sides.map((side) =>
            timber(
                a - 0.7,
                a + 0.7,
                side * railAt - 0.7,
                side * railAt + 0.7,
                railFoot - 1,
                railFoot + 4
            )
        )
    )
    const rails = sides.map((side) =>
        timber(
            -flat,
            flat,
            side * railAt - 0.7,
            side * railAt + 0.7,
            railFoot + 2.8,
            railFoot + 4.1,
            0.4
        )
    )
    const stringers = sides.map((side) =>
        timber(
            -reach + 2,
            reach - 2,
            side * (half - 3.5) - 1.2,
            side * (half - 3.5) + 1.2,
            1,
            deck - thick
        )
    )
    const curbs = sides.map((side) =>
        slab(
            reach,
            side > 0 ? half + 0.4 - curb.width : -half - 0.4,
            side > 0 ? half + 0.4 : -half - 0.4 + curb.width,
            (a) => top(a) + curb.above,
            curb.depth,
            'timber',
            'along'
        )
    )
    const plankDeck = slab(reach, -half, half, top, thick, 'deck', 'across')
    const near = (part: Part): Part => ({ ...part, front: part.bounds.c0 > 0 })
    return [plankDeck, ...stringers, ...[...curbs, ...posts, ...rails].map(near)]
}

// Where the bridge lies in the board's x (right) and y (towards the viewer) when its span runs
// across the screen or up it.
export function toBoard(screenAxis: Axis, a: number, c: number): { x: number; y: number } {
    return screenAxis === Axis.EastWest ? { x: a, y: c } : { x: c, y: a }
}

export function bridgeBounds(screenAxis: Axis, tilt: number): Box {
    const rise = Math.sqrt(1 - tilt * tilt)
    const corners = bridgeParts().flatMap(({ bounds }) =>
        [bounds.a0, bounds.a1].flatMap((a) =>
            [bounds.c0, bounds.c1].flatMap((c) =>
                [bounds.z0, bounds.z1].map((z) => {
                    const { x, y } = toBoard(screenAxis, a, c)
                    return { x, y: y * tilt - z * rise }
                })
            )
        )
    )
    const margin = 1
    const x = Math.min(...corners.map((p) => p.x)) - margin
    const y = Math.min(...corners.map((p) => p.y)) - margin
    const right = Math.max(...corners.map((p) => p.x)) + margin
    const bottom = Math.max(...corners.map((p) => p.y)) + margin
    return { x, y, width: right - x, height: bottom - y }
}
