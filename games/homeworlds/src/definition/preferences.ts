import * as Type from 'typebox'
import type { TitlePreferenceDefinition } from '@tabletop/common'

export const HomeworldsPreferences = Type.Object(
    {
        flatBoard: Type.Boolean(),
        wideMap: Type.Boolean()
    },
    { additionalProperties: false }
)

export const HomeworldsPreferenceDefinition = {
    title: {
        schema: HomeworldsPreferences,
        defaults: {
            flatBoard: false,
            wideMap: false
        },
        version: 1
    }
} satisfies TitlePreferenceDefinition<typeof HomeworldsPreferences>
