import { createGameSessionContext } from '@tabletop/frontend-components'
import { MexicaGameSession } from './session.svelte.js'

const [getContext, setContext] = createGameSessionContext<MexicaGameSession>()

export function setGameSession(session: MexicaGameSession) {
    setContext(session)
}

export function getGameSession(): MexicaGameSession {
    return getContext()
}
