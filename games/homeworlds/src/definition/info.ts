import { GameVisibility, type GameInfo } from '@tabletop/common'
import { GAME_VERSION } from './version.js'
import { HomeworldsConfigurator } from './config.js'
import { HomeworldsPreferenceDefinition } from './preferences.js'

export const HomeworldsInfo: GameInfo = {
    id: 'homeworlds',
    metadata: {
        name: 'Homeworlds',
        bggId: 14634,
        designer: 'John Cooper',
        description:
            "Homeworlds is a 2-player game of interstellar war played with Looney Pyramids. Standing pyramids are stars, lying ones are ships; a ship can travel only between stars of different sizes. Use the colours your ships and stars give you to build, move, trade and capture, sacrifice ships for extra actions, and blow up overpopulated systems. Destroy your opponent's homeworld, or leave them with no ships there, to win.",
        year: '1996',
        minPlayers: 2,
        maxPlayers: 2,
        defaultPlayerCount: 2,
        version: GAME_VERSION,
        hasScores: false,
        beta: true,
        visibility: GameVisibility.Alpha
    },
    configurator: new HomeworldsConfigurator(),
    preferences: HomeworldsPreferenceDefinition
}
