import { assertExists, Color, Hydratable, PlayerState, Visibility } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { CardColor, CardColorSchema } from './map.js'

export const HAND_SIZE = 3

export type WebOfPowerPlayerState = Type.Static<typeof WebOfPowerPlayerState>
export const WebOfPowerPlayerState = Type.Object({
    ...PlayerState.properties,
    hand: Visibility.protect(Type.Array(CardColorSchema, { maxItems: HAND_SIZE }), {
        policy: Visibility.Policy.Owner
    }),
    handCount: Type.Integer({ minimum: 0, maximum: HAND_SIZE }),
    score: Type.Integer({ minimum: 0 })
})

export const WebOfPowerProjectedPlayerState =
    Visibility.createProjectionSchema(WebOfPowerPlayerState)
export type WebOfPowerProjectedPlayerState = Type.Static<typeof WebOfPowerProjectedPlayerState>
const WebOfPowerProjectedPlayerStateValidator = Compile(WebOfPowerProjectedPlayerState)

export class HydratedWebOfPowerPlayerState
    extends Hydratable<typeof WebOfPowerProjectedPlayerState>
    implements WebOfPowerProjectedPlayerState
{
    declare playerId: string
    declare color: Color
    declare hand?: CardColor[]
    declare handCount: number
    declare score: number

    constructor(data: WebOfPowerProjectedPlayerState) {
        super(data, WebOfPowerProjectedPlayerStateValidator)
    }

    knownHand(): CardColor[] {
        assertExists(this.hand, `Player ${this.playerId}'s hand is hidden`)
        return this.hand
    }

    // Whether the hand holds every card listed, counting repeats.
    holds(cards: readonly CardColor[]): boolean {
        const hand = [...this.knownHand()]
        return cards.every((card) => {
            const index = hand.indexOf(card)
            if (index < 0) return false
            hand.splice(index, 1)
            return true
        })
    }

    takeCard(card: CardColor) {
        this.knownHand().push(card)
        this.handCount += 1
    }

    giveUp(cards: readonly CardColor[]) {
        const hand = this.knownHand()
        for (const card of cards) {
            const index = hand.indexOf(card)
            if (index < 0) throw Error(`Player ${this.playerId} holds no ${card} card`)
            hand.splice(index, 1)
        }
        this.handCount = hand.length
    }
}
