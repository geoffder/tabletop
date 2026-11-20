import { describe, expect, it } from 'vitest'
import { neutralTemplesFromConfig } from './config.js'

describe('Mexica config', () => {
    it('defaults neutral temples on, reads a setting and rejects anything else', () => {
        expect(neutralTemplesFromConfig({})).toBe(true)
        expect(neutralTemplesFromConfig({ neutralTemples: false })).toBe(false)
        expect(() => neutralTemplesFromConfig({ neutralTemples: 'yes' })).toThrow()
    })
})
