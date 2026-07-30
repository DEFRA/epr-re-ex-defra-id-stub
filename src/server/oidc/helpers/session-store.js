import * as crypto from 'crypto'
import jsonwebtoken from 'jsonwebtoken'
import { createLogger } from '#/server/common/helpers/logging/logger.js'
import { config } from '#/config/config.js'

const logger = createLogger()

let sessionCache

// Must be called once during server startup (see oidc plugin register) before
// any of the functions below are used. Backed by the same cache engine as
// the yar cookie cache (Redis when deployed) so sessions survive restarts
// and are shared across replicas - a plain in-memory object would not be.
function initSessionStore(server, expiresIn) {
  sessionCache = server.cache({
    cache: config.get('session.cache.name'),
    segment: 'oidc-sessions',
    expiresIn
  })
}

function getSessionId() {
  return crypto.randomUUID()
}

async function getSession(sessionId) {
  if (!sessionId) {
    return undefined
  }
  return (await sessionCache.get(sessionId)) ?? undefined
}

async function setSession(sessionId, session) {
  await sessionCache.set(sessionId, session)
  return session
}

async function newSession(
  scope,
  nonce,
  user,
  challenge,
  challengeMethod,
  forceReselection,
  originalAuthorizeUrl,
  redirectUri,
  state
) {
  const id = getSessionId()

  const session = {
    sessionId: id,
    scopes: scope.split(' '),
    oidcNonce: nonce,
    user,
    granted: false,
    codeChallenge: challenge,
    codeChallengeMethod: challengeMethod,
    forceReselection,
    originalAuthorizeUrl: originalAuthorizeUrl || '',
    redirectUri: redirectUri || '',
    state: state || ''
  }

  await setSession(id, session)

  logger.info(`Creating a new session ${JSON.stringify(session)}`)

  return session
}

async function getSessionByToken(token) {
  const decodedToken = jsonwebtoken.decode(token)
  return getSession(decodedToken?.jti)
}

export { getSession, setSession, getSessionByToken, newSession, initSessionStore }
