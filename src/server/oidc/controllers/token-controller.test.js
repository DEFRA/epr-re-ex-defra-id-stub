import { config } from '#/config/config.js'
import { oidcConfig } from '#/server/oidc/oidc-config.js'
import { generateIDToken } from '#/server/oidc/helpers/oidc-crypto.js'
import {
  getSession,
  getSessionByToken,
  setSession
} from '#/server/oidc/helpers/session-store.js'
import { tokenController } from './token-controller.js'
import { openIdConfigurationController } from './well-known-openid-configuration.js'

vi.mock('#/server/oidc/helpers/oidc-crypto.js', () => ({
  generateToken: vi.fn().mockResolvedValue('access-token'),
  generateIDToken: vi.fn().mockResolvedValue('id-token'),
  generateRefreshToken: vi.fn().mockResolvedValue('refresh-token')
}))

vi.mock('#/server/oidc/helpers/session-store.js', () => ({
  getSession: vi.fn(),
  getSessionByToken: vi.fn(),
  setSession: vi.fn()
}))

vi.mock('#/server/oidc/helpers/validate-code-challenge.js', () => ({
  validateCodeChallenge: () => ({ valid: true })
}))

const issueTokenFrom = async (requestHost) => {
  const request = {
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    info: { host: requestHost },
    payload: {
      client_id: oidcConfig.clientId,
      client_secret: oidcConfig.clientSecret,
      grant_type: 'authorization_code',
      code: 'a-code'
    },
    keys: {},
    registrationsStore: {}
  }
  const h = { response: () => ({ header: () => ({ code: () => undefined }) }) }

  await tokenController.handler(request, h)

  const [, , issuerBase] = generateIDToken.mock.calls[0]
  return `${issuerBase}${oidcConfig.issuerBase}`
}

const discoveryIssuer = () => {
  const h = { response: (body) => ({ code: () => body }) }

  return openIdConfigurationController.handler({}, h).issuer
}

describe('token controller', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSession.mockResolvedValue({ scopes: ['openid'], granted: false })
    setSession.mockResolvedValue(undefined)
  })

  afterEach(() => {
    config.reset('appBaseUrl')
    config.reset('oidc.baseUrl')
    config.reset('oidc.stubInternalUrl')
  })

  it.each([
    { requestHost: 'localhost:13200' },
    { requestHost: 'defra-id-stub:3200' },
    { requestHost: 'somewhere.else' }
  ])(
    'should issue the same issuer whichever host the caller used: $requestHost',
    async ({ requestHost }) => {
      config.set('appBaseUrl', 'http://localhost:13200')
      config.set('oidc.stubInternalUrl', 'http://defra-id-stub:3200')

      const issuer = await issueTokenFrom(requestHost)

      expect(issuer).toBe(`http://defra-id-stub:3200${oidcConfig.issuerBase}`)
    }
  )

  it('should issue the issuer advertised by the discovery document', async () => {
    config.set('appBaseUrl', 'http://localhost:13200')
    config.set('oidc.stubInternalUrl', 'http://defra-id-stub:3200')

    const issuer = await issueTokenFrom('localhost:13200')

    expect(issuer).toBe(discoveryIssuer())
  })

  it('should issue the discovery issuer when stub-internal-url is unset', async () => {
    config.set('appBaseUrl', 'http://localhost:3200')

    const issuer = await issueTokenFrom('somewhere.else')

    expect(issuer).toBe(discoveryIssuer())
  })

  describe('token response', () => {
    const now = new Date('2026-11-05T12:00:00Z')
    const nowSeconds = now.getTime() / 1000

    const issueTokens = async ({ grantType, scopes }) => {
      const session = { scopes, granted: false }
      getSession.mockResolvedValue(session)
      getSessionByToken.mockResolvedValue(session)

      let body
      const request = {
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
        payload: {
          client_id: oidcConfig.clientId,
          client_secret: oidcConfig.clientSecret,
          grant_type: grantType,
          code: 'a-code',
          refresh_token: grantType === 'refresh_token' ? 'old-token' : undefined
        },
        keys: {},
        registrationsStore: {}
      }
      const h = {
        response: (payload) => {
          body = payload
          return { header: () => ({ code: () => undefined }) }
        }
      }

      await tokenController.handler(request, h)

      return body
    }

    beforeEach(() => {
      vi.useFakeTimers({ now })
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it.for([
      { grantType: 'authorization_code' },
      { grantType: 'refresh_token' }
    ])(
      'should issue no access token without the client id scope: $grantType',
      async ({ grantType }) => {
        const body = await issueTokens({
          grantType,
          scopes: ['openid', 'offline_access']
        })

        expect(body).toStrictEqual({
          id_token: 'id-token',
          id_token_expires_in: oidcConfig.ttl,
          not_before: nowSeconds,
          refresh_token: 'refresh-token',
          refresh_token_expires_in: oidcConfig.refreshTtl,
          scope: 'openid offline_access',
          token_type: 'Bearer'
        })
      }
    )

    it.for([
      { grantType: 'authorization_code' },
      { grantType: 'refresh_token' }
    ])(
      'should issue an access token with the client id scope: $grantType',
      async ({ grantType }) => {
        const body = await issueTokens({
          grantType,
          scopes: ['openid', 'offline_access', oidcConfig.clientId]
        })

        expect(body).toStrictEqual({
          access_token: 'access-token',
          expires_in: oidcConfig.ttl,
          expires_on: nowSeconds + oidcConfig.ttl,
          id_token: 'id-token',
          id_token_expires_in: oidcConfig.ttl,
          not_before: nowSeconds,
          refresh_token: 'refresh-token',
          refresh_token_expires_in: oidcConfig.refreshTtl,
          resource: oidcConfig.clientId,
          scope: `openid offline_access ${oidcConfig.clientId}`,
          token_type: 'Bearer'
        })
      }
    )
  })
})
