import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { type HydratedWebOfPowerGameState, PieceKind } from '../model/gameState.js'
import {
    Abbey,
    AbbeySchema,
    CardColor,
    CardColorSchema,
    Country,
    CountrySchema
} from '../model/map.js'

export type PlacePiece = Type.Static<typeof PlacePiece>
export const PlacePiece = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlacePiece),
            playerId: Type.String(),
            // One card naming the country, or two of one colour as a joker. Played cards are shown.
            cards: Type.Array(CardColorSchema, { minItems: 1, maxItems: 2 }),
            kind: Type.Enum(PieceKind),
            country: CountrySchema,
            // The space a cloister goes on; an advisor goes on the country's coat of arms.
            abbey: Type.Optional(AbbeySchema)
        })
    ])
)

export const PlacePieceValidator = Compile(PlacePiece)

export function isPlacePiece(action?: GameAction): action is PlacePiece {
    return action?.type === ActionType.PlacePiece
}

export class HydratedPlacePiece extends HydratableAction<typeof PlacePiece> implements PlacePiece {
    declare type: ActionType.PlacePiece
    declare playerId: string
    declare cards: CardColor[]
    declare kind: PieceKind
    declare country: Country
    declare abbey?: Abbey

    constructor(data: PlacePiece) {
        super(data, PlacePieceValidator)
    }

    apply(state: HydratedWebOfPowerGameState) {
        state.placePiece(this.playerId, this.cards, this)
    }
}
