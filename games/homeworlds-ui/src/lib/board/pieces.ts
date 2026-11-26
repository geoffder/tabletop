import { pieceColor, pieceSize, type PyramidColor, type PyramidSize } from '@tabletop/homeworlds'
import { nestLift, type TableLayout } from './layout.js'
import type { PyramidPose } from './pyramid.js'

// A pyramid where it stands on the table: a star, a ship, or one of a tower in the Bank.
export type DrawnPiece = {
    piece: number
    color: PyramidColor
    size: PyramidSize
    pose: PyramidPose
    x: number
    y: number
    role: 'star' | 'ship' | 'bank'
    // The system a star or ship is in.
    systemId?: number
    ownerId?: string
}

const BANK_YAW = 0.3

// Every piece, on the map or in the Bank, so each is always drawn somewhere.
export function drawnPieces(layout: TableLayout, bank: readonly number[]): Map<number, DrawnPiece> {
    const drawn = new Map<number, DrawnPiece>()
    for (const system of layout.systems) {
        for (const star of system.stars) {
            drawn.set(star.piece, {
                piece: star.piece,
                color: pieceColor(star.piece),
                size: pieceSize(star.piece),
                pose: { kind: 'star', yaw: star.yaw, lift: star.lift },
                x: star.x,
                y: star.y,
                role: 'star',
                systemId: system.id
            })
        }
        for (const ship of system.ships) {
            drawn.set(ship.piece, {
                piece: ship.piece,
                color: pieceColor(ship.piece),
                size: pieceSize(ship.piece),
                pose: { kind: 'ship', heading: ship.heading },
                x: ship.x,
                y: ship.y,
                role: 'ship',
                systemId: system.id,
                ownerId: ship.ownerId
            })
        }
    }
    for (const tower of layout.towers) {
        const stack = bank
            .filter((piece) => pieceColor(piece) === tower.color && pieceSize(piece) === tower.size)
            // The Bank hands out a kind's lowest id first, so it sits on top of its tower.
            .toSorted((a, b) => b - a)
        stack.forEach((piece, level) => {
            drawn.set(piece, {
                piece,
                color: tower.color,
                size: tower.size,
                pose: {
                    kind: 'star',
                    yaw: BANK_YAW,
                    lift: level * nestLift(tower.size, tower.size)
                },
                x: tower.x,
                y: tower.y,
                role: 'bank'
            })
        })
    }
    return drawn
}

function liftOf(drawn: DrawnPiece): number {
    return drawn.pose.kind === 'star' ? drawn.pose.lift : 0
}

// Far first, so nearer pieces stand in front; a nested star after the one it sits on.
export function drawOrder(pieces: Iterable<DrawnPiece>): DrawnPiece[] {
    return [...pieces].toSorted((a, b) => b.y - a.y || liftOf(a) - liftOf(b) || a.x - b.x)
}

export function samePose(a: PyramidPose, b: PyramidPose): boolean {
    if (a.kind === 'star' && b.kind === 'star') return a.yaw === b.yaw && a.lift === b.lift
    if (a.kind === 'ship' && b.kind === 'ship') return a.heading === b.heading
    return false
}
