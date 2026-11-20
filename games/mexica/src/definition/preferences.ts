import * as Type from 'typebox'
import type { TitlePreferenceDefinition } from '@tabletop/common'

export const MexicaPreferences = Type.Object(
    {
        showCoordinates: Type.Boolean(),
        flatBoard: Type.Boolean(),
        rotatedBoard: Type.Boolean(),
        farSide: Type.Boolean()
    },
    { additionalProperties: false }
)

export const MexicaPreferenceDefinition = {
    title: {
        schema: MexicaPreferences,
        defaults: {
            showCoordinates: true,
            flatBoard: false,
            rotatedBoard: false,
            farSide: false
        },
        version: 1
    }
} satisfies TitlePreferenceDefinition<typeof MexicaPreferences>
