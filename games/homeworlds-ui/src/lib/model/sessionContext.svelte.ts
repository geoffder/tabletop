import { createGameSessionContext } from '@tabletop/frontend-components'
import { HomeworldsGameSession } from './session.svelte.js'

const [getContext, setContext] = createGameSessionContext<HomeworldsGameSession>()

export function setGameSession(session: HomeworldsGameSession) {
    setContext(session)
}

export function getGameSession(): HomeworldsGameSession {
    return getContext()
}
