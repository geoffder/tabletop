import { describe, expect, it } from 'vitest'
import { Axis, cellAt } from '@tabletop/mexica'
import { turnSegments, withdrawnText } from './entryText.js'
import type { Step, TurnEntry } from './historyEntries.js'

describe('the Emperor withdrawing districts', () => {
    it('names one district and says it can no longer be founded', () => {
        expect(withdrawnText([4])).toBe(
            'The Emperor withdrew a 4-space district: it can no longer be founded'
        )
    })

    it('counts districts of one size rather than listing their sizes', () => {
        expect(withdrawnText([4, 4])).toBe(
            'The Emperor withdrew two 4-space districts: neither can be founded'
        )
    })

    it('counts mixed sizes first, then lists them smallest first', () => {
        expect(withdrawnText([8, 4])).toBe(
            'The Emperor withdrew two districts, of 4 and 8 spaces: neither can be founded'
        )
        expect(withdrawnText([8, 4, 3, 4])).toBe(
            'The Emperor withdrew four districts, of 3, 4, 4 and 8 spaces: none can be founded'
        )
    })

    it('says "an" before an 8-space district', () => {
        expect(withdrawnText([8])).toBe(
            'The Emperor withdrew an 8-space district: it can no longer be founded'
        )
    })
})

describe('a turn in words', () => {
    // "F2" as a cell: column letter, then row number.
    const cell = (name: string) => cellAt(name.charCodeAt(0) - 65, Number(name.slice(1)) - 1) ?? 0
    const turn = (steps: Step[]): TurnEntry => ({
        id: 'turn',
        kind: 'turn',
        firstIndex: 0,
        lastIndex: steps.length,
        playerId: 'p1',
        steps,
        ended: true
    })
    const words = (entry: TurnEntry) =>
        turnSegments(entry)
            .map((segment) => (segment.kind === 'text' ? segment.text : `@${segment.playerId}`))
            .join('')

    it('reads actions of one kind one after another as one', () => {
        const canal = (a: string, b: string): Step => ({ kind: 'canal', cells: [cell(a), cell(b)] })
        expect(
            words(
                turn([canal('F1', 'F2'), canal('H1', 'I1'), canal('J3', 'J4'), { kind: 'token' }])
            )
        ).toBe(' dug three canals (F1–F2, H1–I1, J3–J4), took an action token')
    })

    it('keeps actions of one kind apart when another comes between them', () => {
        const bridge = (at: string): Step => ({
            kind: 'bridge',
            cell: cell(at),
            axis: Axis.EastWest
        })
        expect(words(turn([bridge('B2'), { kind: 'token' }, bridge('C3')]))).toBe(
            ' built a bridge at B2, took an action token, built a bridge at C3'
        )
    })

    it('names the level once when the temples share it', () => {
        const temple = (at: string, level: 1 | 2 | 3): Step => ({
            kind: 'temple',
            cell: cell(at),
            level
        })
        expect(words(turn([temple('D3', 2), temple('E4', 2)]))).toBe(
            ' built two two-level temples (D3, E4)'
        )
        expect(words(turn([temple('D3', 2), temple('E4', 3)]))).toBe(
            ' built two temples (two-level at D3, three-level at E4)'
        )
    })
})
