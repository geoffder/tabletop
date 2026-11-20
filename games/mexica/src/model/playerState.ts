import { Color, Hydratable, PlayerState } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { CellSchema } from './board.js'
import { ACTION_TOKEN_COUNT } from './pieces.js'

export type MexicaPlayerState = Type.Static<typeof MexicaPlayerState>
export const MexicaPlayerState = Type.Object({
    ...PlayerState.properties,
    score: Type.Integer({ minimum: 0 }),
    actionTokens: Type.Integer({ minimum: 0, maximum: ACTION_TOKEN_COUNT }),
    // Where the Pilli Mexica stands: ground or a bridge. Absent until the player picks a start.
    pilli: Type.Optional(CellSchema)
})

const MexicaPlayerStateValidator = Compile(MexicaPlayerState)

export class HydratedMexicaPlayerState
    extends Hydratable<typeof MexicaPlayerState>
    implements MexicaPlayerState
{
    declare playerId: string
    declare color: Color
    declare score: number
    declare actionTokens: number
    declare pilli?: number

    constructor(data: MexicaPlayerState) {
        super(data, MexicaPlayerStateValidator)
    }
}
