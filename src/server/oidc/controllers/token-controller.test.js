import { config } from '#/config/config.js'
import { oidcConfig } from '#/server/oidc/oidc-config.js'
import { generateToken } from '#/server/oidc/helpers/oidc-crypto.js'
import { getSession, setSession } from '#/server/oidc/helpers/session-store.js'
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

  const [, , issuerBase] = generateToken.mock.calls[0]
  return `${issuerBase}${oidcConfig.issuerBase}`
}

const discoveryIssuer = () => {
  const h = { response: (body) => ({ code: () => body }) }

  return openIdConfigurationController.handler({}, h).issuer
}

describe('token controller', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSession.mockResolvedValue({ scopes: [], granted: false })
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
})
