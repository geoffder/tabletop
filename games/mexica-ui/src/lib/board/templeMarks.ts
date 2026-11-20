import type { Level } from '@tabletop/mexica'
import { blockFaces, type Block, TEMPLE, tierBlocks, stairBlocks } from './templeShape.js'
import type { Box } from './view.js'

// How a temple shows whose it is, drawn in the owner's colour over the stone.
export type OwnerStyle = 'tinted' | 'capped' | 'banded' | 'shrine'

export const OWNER_STYLES: readonly OwnerStyle[] = ['tinted', 'capped', 'banded', 'shrine']

export const TEMPLE_TINT = 0.6

export type OwnerMark = {
    // The marked tops and faces, each a union of rectangles.
    tops: string
    fronts: string
    opacity: number
}

const BAND = 1.8

// Every rectangle is drawn the same way round, so a path of overlapping ones fills their union.
function union(boxes: readonly Box[]): string {
    return boxes
        .filter((box) => box.width > 0 && box.height > 0)
        .map((box) => `M${box.x} ${box.y}h${box.width}v${box.height}h${-box.width}Z`)
        .join('')
}

// The parts of a face either side of the stair in front of it.
function besideStair(box: Box): Box[] {
    const left = -TEMPLE.stairHalf
    const right = TEMPLE.stairHalf
    return [
        { ...box, width: Math.min(box.x + box.width, left) - box.x },
        { ...box, x: right, width: box.x + box.width - right }
    ]
}

export function shrineBlock(level: Level): Block {
    const top = tierBlocks(level)[level - 1]
    const half = top.x1
    return {
        x0: -half * 0.55,
        x1: half * 0.55,
        y0: -half * 0.5,
        y1: half * 0.35,
        z0: top.z1,
        z1: top.z1 + TEMPLE.tier * 0.85
    }
}

export function ownerMark(level: Level, tilt: number, style: OwnerStyle): OwnerMark {
    const tiers = tierBlocks(level)
    const faces = (block: Block) => blockFaces(block, tilt)
    switch (style) {
        case 'tinted': {
            const all = [...tiers, ...stairBlocks(level)].map(faces)
            return {
                tops: union(all.map((face) => face.top)),
                fronts: union(all.map((face) => face.front)),
                opacity: 0.42
            }
        }
        case 'capped': {
            const cap = faces(tiers[level - 1])
            return { tops: union([cap.top]), fronts: union(besideStair(cap.front)), opacity: 0.88 }
        }
        case 'banded': {
            const marks = tiers.map((tier) => {
                const { top, front } = faces(tier)
                const band = (front.height * BAND) / (tier.z1 - tier.z0)
                const rim = BAND * tilt * 0.8
                return {
                    rim: besideStair({ ...top, y: top.y + top.height - rim, height: rim }),
                    band: besideStair({ ...front, height: band })
                }
            })
            return {
                tops: union(marks.flatMap((mark) => mark.rim)),
                fronts: union(marks.flatMap((mark) => mark.band)),
                opacity: 0.9
            }
        }
        case 'shrine': {
            const shrine = faces(shrineBlock(level))
            return { tops: union([shrine.top]), fronts: union([shrine.front]), opacity: 1 }
        }
    }
}

const MARKS = new Map<string, OwnerMark>()

export function templeMark(level: Level, tilt: number): OwnerMark {
    const key = `${level}-${tilt}`
    let mark = MARKS.get(key)
    if (mark === undefined) {
        mark = ownerMark(level, tilt, 'tinted')
        MARKS.set(key, mark)
    }
    return mark
}
