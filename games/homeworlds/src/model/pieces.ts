import * as Type from 'typebox'
import { assertExists } from '@tabletop/common'

export enum PyramidColor {
    Red = 'red',
    Yellow = 'yellow',
    Green = 'green',
    Blue = 'blue'
}

export const PYRAMID_COLORS = [
    PyramidColor.Red,
    PyramidColor.Yellow,
    PyramidColor.Green,
    PyramidColor.Blue
] as const

// A pyramid's size is its pip count: Small 1, Medium 2, Large 3.
export enum PyramidSize {
    Small = 1,
    Medium = 2,
    Large = 3
}

export const PYRAMID_SIZES = [PyramidSize.Small, PyramidSize.Medium, PyramidSize.Large] as const

// Three of each size in each colour: three trios of each colour for two players.
export const COPIES_PER_KIND = 3
export const PIECE_COUNT = PYRAMID_COLORS.length * PYRAMID_SIZES.length * COPIES_PER_KIND

// Ids run colour by colour, size by size, so a piece's colour and size follow from its id.
export type PieceId = Type.Static<typeof PieceId>
export const PieceId = Type.Integer({ minimum: 0, maximum: PIECE_COUNT - 1 })

export type PieceKind = Type.Static<typeof PieceKind>
export const PieceKind = Type.Object({
    color: Type.Enum(PyramidColor),
    size: Type.Enum(PyramidSize)
})

export const ALL_PIECES: readonly number[] = Array.from({ length: PIECE_COUNT }, (_, id) => id)

export function pieceColor(id: number): PyramidColor {
    const color = PYRAMID_COLORS[Math.floor(id / (PYRAMID_SIZES.length * COPIES_PER_KIND))]
    assertExists(color, `No piece ${id}`)
    return color
}

export function pieceSize(id: number): PyramidSize {
    const size = PYRAMID_SIZES[Math.floor(id / COPIES_PER_KIND) % PYRAMID_SIZES.length]
    assertExists(size, `No piece ${id}`)
    return size
}

export function pieceKind(id: number): PieceKind {
    return { color: pieceColor(id), size: pieceSize(id) }
}

export function isPieceId(value: number): boolean {
    return Number.isInteger(value) && value >= 0 && value < PIECE_COUNT
}

export function piecesOfKind(kind: PieceKind): number[] {
    const first =
        (PYRAMID_COLORS.indexOf(kind.color) * PYRAMID_SIZES.length +
            PYRAMID_SIZES.indexOf(kind.size)) *
        COPIES_PER_KIND
    return Array.from({ length: COPIES_PER_KIND }, (_, copy) => first + copy)
}

export function sameKind(a: PieceKind, b: PieceKind): boolean {
    return a.color === b.color && a.size === b.size
}
