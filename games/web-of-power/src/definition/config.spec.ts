import { describe, expect, it } from 'vitest'
import { fasterVariantFromConfig, openDiscardFromConfig } from './config.js'

describe('reading the options', () => {
    it('defaults a missing setting, reads a known one and refuses an unknown one', () => {
        expect(fasterVariantFromConfig({})).toBe(false)
        expect(fasterVariantFromConfig({ fasterVariant: true })).toBe(true)
        expect(() => fasterVariantFromConfig({ fasterVariant: 'yes' })).toThrow()
        expect(openDiscardFromConfig({})).toBe(true)
        expect(openDiscardFromConfig({ openDiscard: false })).toBe(false)
        expect(() => openDiscardFromConfig({ openDiscard: 1 })).toThrow()
    })
})
