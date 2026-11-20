import { GameVisibility, type GameInfo } from '@tabletop/common'
import { GAME_VERSION } from './version.js'
import { WebOfPowerConfigurator } from './config.js'

export const WebOfPowerInfo: GameInfo = {
    id: 'web-of-power',
    metadata: {
        name: 'Web of Power',
        bggId: 491,
        designer: 'Michael Schacht',
        description:
            'Web of Power (Kardinal & König) is a game of influence in medieval Europe for 3 to 5 players. Play cards to found cloisters and send advisors to the courts of nine countries, scoring for the most cloisters in each country, for alliances of advisors between countries and for long chains of cloisters along the roads.',
        year: '2000',
        minPlayers: 3,
        maxPlayers: 5,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        beta: true,
        visibility: GameVisibility.Alpha
    },
    configurator: new WebOfPowerConfigurator()
}
