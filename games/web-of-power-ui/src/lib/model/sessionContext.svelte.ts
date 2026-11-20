import { createGameSessionContext } from '@tabletop/frontend-components'
import { WebOfPowerGameSession } from './session.svelte.js'

const [getContext, setContext] = createGameSessionContext<WebOfPowerGameSession>()

export function setGameSession(session: WebOfPowerGameSession) {
    setContext(session)
}

export function getGameSession(): WebOfPowerGameSession {
    return getContext()
}
