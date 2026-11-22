import { describe, expect, it } from 'vitest'
import { withdrawnText } from './entryText.js'

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
