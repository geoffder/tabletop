import type { Level } from '@tabletop/mexica'
import {
    blockFaces,
    pipEllipses,
    type Block,
    DESIGN,
    shrineBlocks,
    stairBlocks,
    TEMPLE,
    type TempleDesign,
    tierBlocks
} from './templeShape.js'
import type { Box } from './view.js'

export const TEMPLE_TINT = 0.6

// A temple's owner shows as their colour washed over its stone: the union of every block's
// outline seen from the view, each rounded as the stone is.
export type OwnerMark = { path: string; pips: Box[] }

function roundedUnion(outlines: readonly { box: Box; round: number }[]): string {
    return outlines
        .map(({ box, round }) => {
            const r = Math.min(round, box.width / 2, box.height / 2)
            const { x, y, width, height } = box
            return (
                `M${x + r} ${y}h${width - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${height - 2 * r}` +
                `a${r} ${r} 0 0 1 ${-r} ${r}h${-(width - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}` +
                `v${-(height - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}Z`
            )
        })
        .join('')
}

export function ownerMark(level: Level, tilt: number, design: TempleDesign = DESIGN): OwnerMark {
    const rounded = (round: number) => (block: Block) => ({ block, round })
    const outlines = [
        ...tierBlocks(level, design).map(rounded(TEMPLE.round)),
        ...stairBlocks(level, design).map(rounded(TEMPLE.stairRound)),
        ...shrineBlocks(level, design).map(rounded(0.6))
    ].map(({ block, round }) => {
        const { top, front } = blockFaces(block, tilt)
        return { box: { ...top, height: front.y + front.height - top.y }, round }
    })
    return { path: roundedUnion(outlines), pips: pipEllipses(level, tilt, design) }
}

const MARKS = new Map<string, OwnerMark>()

export function templeMark(level: Level, tilt: number): OwnerMark {
    const key = `${level}-${tilt}`
    let mark = MARKS.get(key)
    if (mark === undefined) {
        mark = ownerMark(level, tilt)
        MARKS.set(key, mark)
    }
    return mark
}
