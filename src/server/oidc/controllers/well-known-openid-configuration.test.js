import { config } from '#/config/config.js'
import { openIdConfigurationController } from './well-known-openid-configuration.js'

const invoke = () => {
  const h = { response: (body) => ({ code: () => body }) }
  return openIdConfigurationController.handler({}, h)
}

const basePath = '/epr-re-ex-defra-id-stub'

describe('well-known openid-configuration', () => {
  afterEach(() => {
    config.reset('appBaseUrl')
    config.reset('oidc.baseUrl')
    config.reset('oidc.stubInternalUrl')
  })

  it('serves browser endpoints from the external base and server endpoints from the internal base', () => {
    config.set('appBaseUrl', 'http://localhost:13200')
    config.set('oidc.stubInternalUrl', 'http://defra-id-stub:3200')

    const doc = invoke()

    expect(doc.authorization_endpoint).toBe(
      `http://localhost:13200${basePath}/authorize`
    )
    expect(doc.end_session_endpoint).toBe(
      `http://localhost:13200${basePath}/logout`
    )
    expect(doc.issuer).toBe(`http://defra-id-stub:3200${basePath}`)
    expect(doc.token_endpoint).toBe(
      `http://defra-id-stub:3200${basePath}/token`
    )
    expect(doc.jwks_uri).toBe(
      `http://defra-id-stub:3200${basePath}/.well-known/jwks.json`
    )
    expect(doc.userinfo_endpoint).toBe(
      `http://defra-id-stub:3200${basePath}/userinfo`
    )
  })

  it('defaults the internal base to the external base when STUB_INTERNAL_URL is unset', () => {
    config.set('appBaseUrl', 'http://localhost:3200')

    const doc = invoke()

    expect(doc.issuer).toBe(`http://localhost:3200${basePath}`)
    expect(doc.token_endpoint).toBe(`http://localhost:3200${basePath}/token`)
    expect(doc.authorization_endpoint).toBe(
      `http://localhost:3200${basePath}/authorize`
    )
  })
})
