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

    it('names each size, smallest first, with "an" before an 8 or an 11', () => {
        expect(withdrawnText([11, 3, 8])).toBe(
            'The Emperor withdrew a 3-space district, an 8-space district and an 11-space district: none can be founded'
        )
        expect(withdrawnText([5, 5, 13])).toBe(
            'The Emperor withdrew two 5-space districts and a 13-space district: none can be founded'
        )
    })
})
