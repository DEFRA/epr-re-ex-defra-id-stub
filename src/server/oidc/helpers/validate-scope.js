import { oidcConfig } from '#/server/oidc/oidc-config.js'

const isSupported = (scope) =>
  oidcConfig.scopesSupported.includes(scope) || scope === oidcConfig.clientId

const validateScope = (scope) => {
  const scopes = scope.split(' ')

  return scopes.filter((s) => s !== '').filter((s) => !isSupported(s))
}

export { validateScope }
