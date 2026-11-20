import type { Level } from '@tabletop/mexica'
import {
    blockFaces,
    pipEllipses,
    riseOf,
    type Block,
    DESIGN,
    shrineBlocks,
    stairBlocks,
    stairParts,
    TEMPLE,
    type TempleDesign,
    tierBlocks,
    topHalf
} from './templeShape.js'
import type { Box } from './view.js'

export const TEMPLE_TINT = 0.6

// A temple's owner shows as their colour washed over its stone: the union of every block's
// outline seen from the view, each rounded as the stone is. The stair's outline, from the top
// tier's front edge to its foot, and the front edges of its treads let it be picked out.
export type OwnerMark = { path: string; stair: string; treads: string; pips: Box[] }

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

function hull(boxes: readonly Box[]): Box {
    const x = Math.min(...boxes.map((box) => box.x))
    const y = Math.min(...boxes.map((box) => box.y))
    const right = Math.max(...boxes.map((box) => box.x + box.width))
    const bottom = Math.max(...boxes.map((box) => box.y + box.height))
    return { x, y, width: right - x, height: bottom - y }
}

function outline(tilt: number) {
    return ({ block, round }: { block: Block; round: number }) => {
        const { top, front } = blockFaces(block, tilt)
        return { box: { ...top, height: front.y + front.height - top.y }, round }
    }
}

export function ownerMark(level: Level, tilt: number, design: TempleDesign = DESIGN): OwnerMark {
    const rounded = (round: number) => (block: Block) => ({ block, round })
    const outlines = [
        ...tierBlocks(level, design).map(rounded(TEMPLE.round)),
        ...stairBlocks(level, design).map(rounded(TEMPLE.stairRound)),
        ...shrineBlocks(level, design).map(rounded(0.6))
    ].map(outline(tilt))
    const front = topHalf(level)
    const stair = hull(
        stairBlocks(level, design)
            .map((block) => ({ block: { ...block, y0: Math.max(block.y0, front) }, round: 0 }))
            .map(outline(tilt))
            .map(({ box }) => box)
    )
    const rise = riseOf(tilt)
    const treads = stairParts(level, design)
        .steps.map((step) => {
            const y = step.y1 * tilt - step.z1 * rise
            return `M${step.x0 + 0.3} ${y}H${step.x1 - 0.3}`
        })
        .join('')
    return {
        path: roundedUnion(outlines),
        stair: roundedUnion([{ box: stair, round: 0.8 }]),
        treads,
        pips: pipEllipses(level, tilt, design)
    }
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
