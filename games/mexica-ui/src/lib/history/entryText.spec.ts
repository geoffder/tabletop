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

    it('names each size once, smallest first, sharing one noun', () => {
        expect(withdrawnText([4, 8])).toBe(
            'The Emperor withdrew a 4- and an 8-space districts: neither can be founded'
        )
        expect(withdrawnText([8, 4, 3, 4])).toBe(
            'The Emperor withdrew a 3-, two 4-, and an 8-space districts: none can be founded'
        )
        expect(withdrawnText([5, 5, 11])).toBe(
            'The Emperor withdrew two 5- and an 11-space districts: none can be founded'
        )
    })
})
