import { config } from '#/config/config.js'
import { oidcConfig } from '#/server/oidc/oidc-config.js'

// Browser-facing endpoints (the user's agent redirects here) use the external
// base; server-to-server endpoints and the issuer use the internal base so the
// fe/be can reach them in-network and the getHost-derived token `iss` matches.
// When STUB_INTERNAL_URL is unset the internal base falls back to the external
// one, preserving single-stack behaviour.
const buildOpenIdConfiguration = () => {
  const externalBaseUrl = config.get('oidc.baseUrl') || config.get('appBaseUrl')
  const internalBaseUrl = config.get('oidc.stubInternalUrl') || externalBaseUrl

  return {
    issuer: `${internalBaseUrl}${oidcConfig.issuerBase}`,
    authorization_endpoint: `${externalBaseUrl}${oidcConfig.authorizationEndpoint}`,
    pushed_authorization_request_endpoint: `${internalBaseUrl}${oidcConfig.issuerBase}/par`,
    token_endpoint: `${internalBaseUrl}${oidcConfig.tokenEndpoint}`,
    jwks_uri: `${internalBaseUrl}${oidcConfig.jwksEndpoint}`,
    userinfo_endpoint: `${internalBaseUrl}${oidcConfig.userinfoEndpoint}`,
    introspection_endpoint: `${internalBaseUrl}${oidcConfig.issuerBase}/introspect`,
    end_session_endpoint: `${externalBaseUrl}${oidcConfig.issuerBase}/logout`,

    grant_types_supported: oidcConfig.grantTypesSupported,
    response_types_supported: oidcConfig.responseTypesSupported,
    subject_types_supported: oidcConfig.subjectTypesSupported,
    id_token_signing_alg_values_supported:
      oidcConfig.idTokenSigningAlgValuesSupported,
    scopes_supported: oidcConfig.scopesSupported,
    token_endpoint_auth_methods_supported:
      oidcConfig.tokenEndpointAuthMethodsSupported,
    claims_supported: oidcConfig.claimsSupported,
    code_challenge_methods_supported: oidcConfig.claimsSupported
  }
}

const openIdConfigurationController = {
  handler: (request, h) => {
    return h.response(buildOpenIdConfiguration()).code(200)
  }
}

export { openIdConfigurationController }
