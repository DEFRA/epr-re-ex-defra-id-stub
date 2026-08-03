import { config } from '#/config/config.js'

export const getExternalBaseUrl = () =>
  config.get('oidc.baseUrl') || config.get('appBaseUrl')

export const getInternalBaseUrl = () =>
  config.get('oidc.stubInternalUrl') || getExternalBaseUrl()
