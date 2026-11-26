import { describe, expect, it } from 'vitest'
import { piecesOfKind, PyramidColor, PyramidSize } from '@tabletop/homeworlds'
import { stepSegments, pieceName, type Segment } from './entryText.js'
import type { ActionEntry } from './historyEntries.js'

function read(segments: Segment[]): string {
    return segments
        .map((segment) => {
            switch (segment.kind) {
                case 'text':
                    return segment.text
                case 'piece':
                    return `[${pieceName(segment.piece)}${segment.ship ? ' ship' : ' star'}]`
                case 'player':
                    return `<${segment.playerId}>`
                case 'homeworld':
                    return `<home ${segment.seat}>`
                case 'color':
                    return segment.color
            }
        })
        .join('')
}

const span = { id: 'a', firstIndex: 0, lastIndex: 0, playerId: 'p', turnEnded: false }
const [smallYellow] = piecesOfKind({ color: PyramidColor.Yellow, size: PyramidSize.Small })
const [largeBlue] = piecesOfKind({ color: PyramidColor.Blue, size: PyramidSize.Large })

describe('stepSegments', () => {
    it('names the ship and where it went', () => {
        const move: ActionEntry = {
            ...span,
            kind: 'move',
            ship: smallYellow ?? 0,
            from: { kind: 'homeworld', seat: 0 },
            to: { kind: 'star', piece: largeBlue ?? 0 },
            abandoned: false
        }
        expect(read(stepSegments(move))).toBe(
            ' moved [Small yellow ship] from <home 0> to [Large blue star]'
        )
        expect(read(stepSegments(move, true))).toBe(
            ' moved [Small yellow ship] to [Large blue star]'
        )
    })

    it('counts a sacrifice and the actions left unused', () => {
        const sacrifice: ActionEntry = {
            ...span,
            kind: 'sacrifice',
            ship: largeBlue ?? 0,
            abandoned: false
        }
        expect(read(stepSegments(sacrifice))).toBe(
            ' sacrificed [Large blue ship] for 3 blue actions'
        )
        const end: ActionEntry = { ...span, kind: 'endTurn', passed: false, unused: 1 }
        expect(read(stepSegments(end))).toBe(' ended the turn, 1 action unused')
    })
})
