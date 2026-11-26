import * as Type from 'typebox'
import {
    assertExists,
    BaseConfigurator,
    ConfigOptionType,
    type GameConfig,
    type GameConfigOptions
} from '@tabletop/common'

export enum FirstPlayer {
    Random = 'Random',
    Creator = 'Creator',
    Opponent = 'Opponent'
}

export enum Setup {
    // Each player builds their own homeworld in the setup round.
    Chosen = 'Chosen',
    // The rulebook's suggestion for a first game, set out at the start.
    FirstGame = 'FirstGame'
}

export type HomeworldsGameConfig = Type.Static<typeof HomeworldsGameConfig>
export const HomeworldsGameConfig = Type.Object({
    setup: Type.Optional(Type.Enum(Setup)),
    firstPlayer: Type.Optional(Type.Enum(FirstPlayer))
})

export const HomeworldsGameConfigOptions: GameConfigOptions = [
    {
        id: 'setup',
        type: ConfigOptionType.List,
        name: 'Homeworlds',
        description:
            "How the game begins: each player builds a homeworld of two stars and a Large ship, or both start from the rulebook's first-game setup.",
        default: Setup.Chosen,
        options: [
            {
                name: 'Players choose',
                value: Setup.Chosen,
                description:
                    'The first player builds a homeworld of two stars and a Large ship, any sizes and colours, then the second player builds theirs.'
            },
            {
                name: 'First-game setup',
                value: Setup.FirstGame,
                description:
                    "The rulebook's suggestion: both players start with a Large Green ship; the first player's homeworld is a Large Blue and a Small Red star, the second player's a Medium Red and a Small Blue."
            }
        ],
        alwaysShow: true
    },
    {
        id: 'firstPlayer',
        type: ConfigOptionType.List,
        name: 'First player',
        description: 'Who builds a homeworld first and takes the first turn.',
        default: FirstPlayer.Random,
        options: [
            {
                name: 'Random',
                value: FirstPlayer.Random,
                description: 'The first player is drawn by lot.'
            },
            {
                name: 'Game creator',
                value: FirstPlayer.Creator,
                description: 'The player who created the game goes first.'
            },
            {
                name: 'Opponent',
                value: FirstPlayer.Opponent,
                description: "The creator's opponent goes first."
            }
        ],
        alwaysShow: true
    }
]

export class HomeworldsConfigurator extends BaseConfigurator {
    schema = HomeworldsGameConfig
    options = HomeworldsGameConfigOptions
}

export function setupFromConfig(config: GameConfig): Setup {
    if (config.setup === undefined) return Setup.Chosen
    const setup = Object.values(Setup).find((known) => known === config.setup)
    assertExists(setup, `Unknown setup ${String(config.setup)}`)
    return setup
}

export function firstPlayerFromConfig(config: GameConfig): FirstPlayer {
    if (config.firstPlayer === undefined) return FirstPlayer.Random
    const choice = Object.values(FirstPlayer).find((known) => known === config.firstPlayer)
    assertExists(choice, `Unknown choice of first player ${String(config.firstPlayer)}`)
    return choice
}
