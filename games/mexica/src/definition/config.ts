import * as Type from 'typebox'
import {
    BaseConfigurator,
    ConfigOptionType,
    type GameConfig,
    type GameConfigOptions
} from '@tabletop/common'

export type MexicaGameConfig = Type.Static<typeof MexicaGameConfig>
export const MexicaGameConfig = Type.Object({
    neutralTemples: Type.Optional(Type.Boolean())
})

export const MexicaGameConfigOptions: GameConfigOptions = [
    {
        id: 'neutralTemples',
        type: ConfigOptionType.Boolean,
        name: 'Neutral temples (2 players)',
        description:
            "Peter Steinert's two-player rule: ten neutral temples, twenty levels in all, start on the island at random and compete for places in every district.",
        default: true
    }
]

export class MexicaConfigurator extends BaseConfigurator {
    schema = MexicaGameConfig
    options = MexicaGameConfigOptions
}

export function neutralTemplesFromConfig(config: GameConfig): boolean {
    const value = config.neutralTemples
    if (value === undefined) return true
    if (typeof value !== 'boolean') throw Error(`Unknown neutralTemples setting ${String(value)}`)
    return value
}
