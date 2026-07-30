import Joi from 'joi'

import { config } from '#/config/config.js'
import { buildErrorDetails } from '#/server/common/helpers/build-error-details.js'
import { renderLoginPage } from '#/server/oidc/helpers/render-login-page.js'
import { loginFormValidation } from '#/server/oidc/helpers/schemas/login-form-validation.js'
import { loginValidation } from '#/server/oidc/helpers/schemas/login-validation.js'
import { newSession } from '#/server/oidc/helpers/session-store.js'
import {
  findAllUsers,
  findTemporaryUsers,
  findUser
} from '#/server/oidc/helpers/users.js'
import { validateScope } from '#/server/oidc/helpers/validate-scope.js'
import { oidcBasePath, oidcConfig } from '#/server/oidc/oidc-config.js'
import { findRelationships } from '#/server/registration/helpers/find-relationships.js'
import { registrationAction } from '#/server/registration/helpers/registration-paths.js'

const appBaseUrl = config.get('appBaseUrl')

function validateOidcRequest(
  { scope, clientId, responseType, codeChallengeMethod },
  logger
) {
  const unsupportedScopes = validateScope(scope)
  if (unsupportedScopes.length > 0) {
    logger.error(`Unsupported scopes ${unsupportedScopes.join(',')}`)
    return `Unsupported scopes ${unsupportedScopes.join(',')}`
  }

  if (clientId !== oidcConfig.clientId) {
    logger.warn(`Invalid client ID ${clientId}`)
  }

  if (!oidcConfig.responseTypesSupported.includes(responseType)) {
    logger.error(`Invalid response type ${responseType}`)
    return `Unsupported response type ${responseType}`
  }

  if (
    codeChallengeMethod &&
    !oidcConfig.codeChallengeMethodsSupported.includes(codeChallengeMethod)
  ) {
    logger.error(`Invalid code challenge method ${codeChallengeMethod}`)
    return `Unsupported code_challenge_method  ${codeChallengeMethod}`
  }

  return null
}

// Rebuilds the original /authorize URL from a POST /login payload's hidden
// OIDC fields, so "New registration" (reached from a re-rendered login form)
// can thread back through the full authorize flow rather than dropping to
// the client's bare redirect_uri. Returns null for a standalone login (no
// active OIDC request to preserve).
function rebuildOriginalAuthorizeUrl(payload) {
  const {
    client_id: clientId,
    response_type: responseType,
    redirect_uri: redirectUri,
    state,
    scope,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod,
    forceReselection,
    serviceId
  } = payload

  if (!clientId || !responseType || !redirectUri || !state || !scope) {
    return null
  }

  const url = new URL(`${appBaseUrl}${oidcBasePath}/authorize`)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('response_type', responseType)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state', state)
  url.searchParams.set('scope', scope)
  if (nonce) {
    url.searchParams.set('nonce', nonce)
  }
  if (codeChallenge) {
    url.searchParams.set('code_challenge', codeChallenge)
  }
  if (codeChallengeMethod) {
    url.searchParams.set('code_challenge_method', codeChallengeMethod)
  }
  if (forceReselection) {
    url.searchParams.set('forceReselection', forceReselection)
  }
  if (serviceId) {
    url.searchParams.set('serviceId', serviceId)
  }
  return url.toString()
}

async function completeAuthorization(request, h, user, params) {
  const {
    scope,
    nonce,
    codeChallenge,
    codeChallengeMethod,
    forceReselection,
    originalAuthorizeUrl,
    redirectUri,
    state
  } = params

  request.yar.set('authenticated_user', user.email)

  const session = await newSession(
    scope,
    nonce,
    user,
    codeChallenge,
    codeChallengeMethod,
    forceReselection,
    originalAuthorizeUrl,
    redirectUri,
    state
  )

  const relationships = await findRelationships(
    user.userId,
    request.registrationsStore
  )

  if (relationships && relationships.length > 0 && !session.relationshipId) {
    request.logger.info(
      { userId: user.userId, relationshipCount: relationships.length },
      'User has relationships, redirect to organisation picker'
    )
    return h.redirect(
      `${oidcBasePath}/organisations?sessionId=${session.sessionId}`
    )
  }

  const location = new URL(redirectUri)
  location.searchParams.append('code', session.sessionId)
  location.searchParams.append('state', state)
  request.logger.info(
    `Authenticated, redirect to location: [${location.toString()}]`
  )
  return h.redirect(location.toString())
}

const authorizeController = {
  handler: async (request, h) => {
    const redirectUri = request.query?.redirect_uri
    const originalAuthorizeUrl = `${appBaseUrl}${request.path}${request.url.search}`

    // Check for cached authenticated user in session (SSO behavior)
    const cachedUserEmail = request.yar.get('authenticated_user')
    const queryUser = request.query.user
    const showLoginEnabled = config.get('oidc.showLogin')

    // Login is email-only (no password), so the "?user=email" shortcut works
    // for any known user (permanent or temporary) even with interactive
    // login enabled - it's how the registration summary page's "login" link
    // completes the loop.
    const isKnownUserShortcut =
      showLoginEnabled && queryUser
        ? await request.registrationsStore.isEmailTaken(queryUser)
        : false
    const bypassInteractiveLogin = !showLoginEnabled || isKnownUserShortcut

    if (!bypassInteractiveLogin && !cachedUserEmail) {
      request.logger.debug('No cached session, rendering login form')
      const allUsers = await findAllUsers(request.registrationsStore)

      if (allUsers.length === 0) {
        request.logger.info('No users found, redirect to register page')
        return h.redirect(registrationAction(originalAuthorizeUrl))
      }

      const temporaryUsers = await findTemporaryUsers(
        request.registrationsStore
      )

      return renderLoginPage(h, {
        oidcParams: request.query,
        allUsers: temporaryUsers,
        newRegistrationLink: registrationAction(originalAuthorizeUrl)
      })
    }

    const validationResult = loginValidation.validate(request.query, {
      abortEarly: false
    })

    if (validationResult?.error) {
      request.logger.warn(validationResult?.error, 'Login query error')
      const errorDetails = buildErrorDetails(validationResult.error.details)

      request.yar.flash('validationFailure', {
        formValues: request.query,
        formErrors: errorDetails
      })

      const errorMessages = Object.entries(errorDetails)
        .map(([field, error]) => `${field}: ${error.message}`)
        .join(', ')

      return h.response(`Unsupported payload: ${errorMessages}`).code(400)
    }

    // Use cached user email if no user query param provided (SSO behavior)
    const loginUser = queryUser || cachedUserEmail
    const clientId = request.query.client_id
    const responseType = request.query.response_type
    const { scope, state } = request.query
    const codeChallengeMethod = request.query.code_challenge_method

    const validationError = validateOidcRequest(
      { scope, clientId, responseType, codeChallengeMethod },
      request.logger
    )
    if (validationError) {
      return h.response(validationError).code(400)
    }

    const user = await findUser(loginUser, request.registrationsStore)
    if (user === undefined) {
      request.logger.error(`Invalid user selected ${request.query.user}`)
      return h.response(`Invalid user selection!`).code(400)
    }

    const forceReselection = request.query.forceReselection === 'true'

    return completeAuthorization(request, h, user, {
      scope,
      nonce: request.query.nonce,
      codeChallenge: request.query.code_challenge,
      codeChallengeMethod,
      forceReselection,
      originalAuthorizeUrl,
      redirectUri,
      state
    })
  }
}

const loginController = {
  options: {
    validate: {
      query: Joi.object({
        redirect_uri: Joi.string().uri().optional()
      })
    }
  },
  handler: async (request, h) => {
    const redirectUri = request.query.redirect_uri
    const allUsers = await findAllUsers(request.registrationsStore)

    if (allUsers.length === 0) {
      request.logger.info(
        `No users found, redirect to register page: [${request.url}]`
      )
      return h.redirect(registrationAction(redirectUri))
    }

    const temporaryUsers = await findTemporaryUsers(request.registrationsStore)

    return renderLoginPage(h, {
      oidcParams: request.query,
      allUsers: temporaryUsers,
      newRegistrationLink: registrationAction(redirectUri)
    })
  }
}

const loginSubmitController = {
  handler: async (request, h) => {
    const payload = request?.payload ?? {}
    const temporaryUsers = await findTemporaryUsers(request.registrationsStore)
    const newRegistrationLink = registrationAction(
      rebuildOriginalAuthorizeUrl(payload) ?? payload.redirect_uri
    )

    const validationResult = loginFormValidation.validate(payload, {
      abortEarly: false
    })

    if (validationResult?.error) {
      const formErrors = buildErrorDetails(validationResult.error.details)
      return renderLoginPage(h, {
        oidcParams: payload,
        allUsers: temporaryUsers,
        email: payload.email,
        formErrors,
        newRegistrationLink
      })
    }

    const user = await findUser(payload.email, request.registrationsStore)

    if (!user) {
      request.logger.warn({ email: payload.email }, 'Invalid login attempt')
      return renderLoginPage(h, {
        oidcParams: payload,
        allUsers: temporaryUsers,
        email: payload.email,
        formErrors: {
          email: { message: 'No account found for this email address' }
        },
        newRegistrationLink
      })
    }

    const {
      client_id: clientId,
      response_type: responseType,
      redirect_uri: redirectUri,
      state,
      scope,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: codeChallengeMethod,
      forceReselection
    } = payload

    // Standalone login (not part of an active OIDC request, e.g. from the
    // home page) - just establish the SSO session and go home.
    if (!clientId || !responseType || !redirectUri || !state || !scope) {
      request.yar.set('authenticated_user', user.email)
      return h.redirect('/')
    }

    const validationError = validateOidcRequest(
      { scope, clientId, responseType, codeChallengeMethod },
      request.logger
    )
    if (validationError) {
      return h.response(validationError).code(400)
    }

    return completeAuthorization(request, h, user, {
      scope,
      nonce,
      codeChallenge,
      codeChallengeMethod,
      forceReselection: forceReselection === 'true',
      originalAuthorizeUrl: `${appBaseUrl}${oidcBasePath}/authorize`,
      redirectUri,
      state
    })
  }
}

export { authorizeController, loginController, loginSubmitController }
