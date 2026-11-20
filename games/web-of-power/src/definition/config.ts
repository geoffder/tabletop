import * as Type from 'typebox'
import {
    BaseConfigurator,
    ConfigOptionType,
    type GameConfig,
    type GameConfigOptions
} from '@tabletop/common'

export type WebOfPowerGameConfig = Type.Static<typeof WebOfPowerGameConfig>
export const WebOfPowerGameConfig = Type.Object({
    fasterVariant: Type.Optional(Type.Boolean()),
    openDiscard: Type.Optional(Type.Boolean())
})

export const WebOfPowerGameConfigOptions: GameConfigOptions = [
    {
        id: 'fasterVariant',
        type: ConfigOptionType.Boolean,
        name: 'Faster variant',
        description:
            "The rulebook's variant with fewer restrictions: pieces may go in two countries a turn, and two cloisters may open an empty country.",
        default: false
    },
    {
        id: 'openDiscard',
        type: ConfigOptionType.Boolean,
        name: 'Open discard pile',
        description:
            'Anyone may look through the discard pile, so cards played and exchanged need not be remembered.',
        default: true
    }
]

export class WebOfPowerConfigurator extends BaseConfigurator {
    schema = WebOfPowerGameConfig
    options = WebOfPowerGameConfigOptions
}

export function fasterVariantFromConfig(config: GameConfig): boolean {
    return booleanFromConfig(config, 'fasterVariant', false)
}

export function openDiscardFromConfig(config: GameConfig): boolean {
    return booleanFromConfig(config, 'openDiscard', true)
}

function booleanFromConfig(config: GameConfig, key: string, fallback: boolean): boolean {
    const value = config[key]
    if (value === undefined) return fallback
    if (typeof value !== 'boolean') throw Error(`Unknown ${key} setting ${String(value)}`)
    return value
}
