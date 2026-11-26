import { pieceColor, pieceSize, type PyramidColor } from '@tabletop/homeworlds'
import type { ActionEntry, SystemName } from './historyEntries.js'

// A piece drawn small in the text: standing as a star, lying as a ship.
export type PieceSegment = { kind: 'piece'; piece: number; ship: boolean }

export type Segment =
    | { kind: 'text'; text: string }
    | PieceSegment
    | { kind: 'player'; playerId: string }
    | { kind: 'homeworld'; seat: number }
    | { kind: 'color'; color: PyramidColor }

const text = (value: string): Segment => ({ kind: 'text', text: value })
const ship = (piece: number): Segment => ({ kind: 'piece', piece, ship: true })
const star = (piece: number): Segment => ({ kind: 'piece', piece, ship: false })

function system(name: SystemName): Segment[] {
    return name.kind === 'homeworld' ? [{ kind: 'homeworld', seat: name.seat }] : [star(name.piece)]
}

const SIZE_WORD = ['', 'Small', 'Medium', 'Large']

export function pieceName(piece: number): string {
    return `${SIZE_WORD[pieceSize(piece)]} ${pieceColor(piece)}`
}

// Spaces live inside text segments: Svelte trims whitespace at the edges of template blocks.
// The brief form keeps the action banner to one line; the history panel uses the full one.
export function stepSegments(entry: ActionEntry, brief = false): Segment[] {
    switch (entry.kind) {
        case 'homeworld':
            return [
                text(' built a homeworld of '),
                star(entry.stars[0] ?? 0),
                text(' and '),
                star(entry.stars[1] ?? 0),
                text(' with '),
                ship(entry.ship)
            ]
        case 'build':
            return [text(' built '), ship(entry.piece), text(' at '), ...system(entry.at)]
        case 'move':
            return [
                text(' moved '),
                ship(entry.ship),
                ...(brief ? [] : [text(' from '), ...system(entry.from)]),
                text(' to '),
                ...system(entry.to)
            ]
        case 'discover':
            return [text(' discovered '), star(entry.star), text(' with '), ship(entry.ship)]
        case 'capture':
            return [
                text(' captured '),
                ship(entry.ship),
                ...(brief
                    ? []
                    : [
                          text(' from '),
                          { kind: 'player', playerId: entry.fromOwnerId } satisfies Segment
                      ])
            ]
        case 'trade':
            return [text(' traded '), ship(entry.ship), text(' for '), ship(entry.piece)]
        case 'sacrifice':
            return [
                text(' sacrificed '),
                ship(entry.ship),
                text(
                    ` for ${pieceSize(entry.ship)} ${pieceColor(entry.ship)} action${pieceSize(entry.ship) > 1 ? 's' : ''}`
                )
            ]
        case 'catastrophe':
            return [
                text(' blew up '),
                { kind: 'color', color: entry.color },
                text(' at '),
                ...system(entry.at),
                ...(brief
                    ? []
                    : [
                          text(
                              entry.removed
                                  ? ', destroying the system'
                                  : entry.stars.length > 0
                                    ? ', destroying half the homeworld'
                                    : `, destroying ${entry.ships} ship${entry.ships === 1 ? '' : 's'}`
                          )
                      ])
            ]
        case 'endTurn':
            return [
                text(
                    entry.passed
                        ? ' passed'
                        : entry.unused > 0
                          ? ` ended the turn, ${entry.unused} action${entry.unused === 1 ? '' : 's'} unused`
                          : ' ended the turn'
                )
            ]
    }
}
