import { GameVisibility, type GameInfo } from '@tabletop/common'
import { GAME_VERSION } from './version.js'
import { MexicaConfigurator } from './config.js'

export const MexicaInfo: GameInfo = {
    id: 'mexica',
    metadata: {
        name: 'Mexica',
        bggId: 2955,
        designer: 'Wolfgang Kramer & Michael Kiesling',
        description:
            'Mexica is a game of building Tenochtitlan for 2 to 4 players. Spend six action points a turn to dig canals that cut the island into districts, found them when their size matches the Emperor’s commands, cross the water by bridge and boat, and raise temples to hold the most levels in each district when the two periods score.',
        year: '2002',
        minPlayers: 2,
        maxPlayers: 4,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        beta: true,
        visibility: GameVisibility.Alpha
    },
    configurator: new MexicaConfigurator()
}
