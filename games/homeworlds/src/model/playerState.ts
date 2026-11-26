import { Color, Hydratable, PlayerState } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'

// Pieces belong to no player; a player's colour only marks their seat.
export type HomeworldsPlayerState = Type.Static<typeof HomeworldsPlayerState>
export const HomeworldsPlayerState = PlayerState

export const HomeworldsPlayerStateValidator = Compile(HomeworldsPlayerState)

export class HydratedHomeworldsPlayerState
    extends Hydratable<typeof HomeworldsPlayerState>
    implements HomeworldsPlayerState
{
    declare playerId: string
    declare color: Color

    constructor(data: HomeworldsPlayerState) {
        super(data, HomeworldsPlayerStateValidator)
    }
}
