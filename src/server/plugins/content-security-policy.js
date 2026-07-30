import Blankie from 'blankie'

/**
 * Manage content security policies.
 * @satisfies {import('@hapi/hapi').Plugin}
 */
const contentSecurityPolicy = {
  plugin: Blankie,
  options: {
    // Hash 'sha256-GUQ5ad8JK5KmEWmROf3LZd9ge94daqNvd8xy9YS1iDw=' is to support a GOV.UK frontend script bundled within Nunjucks macros
    // https://frontend.design-system.service.gov.uk/import-javascript/#if-our-inline-javascript-snippet-is-blocked-by-a-content-security-policy
    defaultSrc: ['self'],
    fontSrc: ['self', 'data:'],
    connectSrc: ['self', 'wss', 'data:'],
    mediaSrc: ['self'],
    styleSrc: ['self'],
    scriptSrc: [
      'self',
      "'sha256-GUQ5ad8JK5KmEWmROf3LZd9ge94daqNvd8xy9YS1iDw='"
    ],
    imgSrc: ['self', 'data:'],
    frameSrc: ['self', 'data:'],
    objectSrc: ['none'],
    frameAncestors: ['none'],
    // Not 'self': this app's OIDC login/organisation-picker forms complete
    // by redirecting to whatever redirect_uri a relying-party client
    // registers (arbitrary origin, by design). Chrome enforces form-action
    // across a form submission's entire redirect chain, so 'self' here
    // blocks the final cross-origin hop back to the client - breaking every
    // real login. cdp-defra-id-stub has no CSP plugin at all, so it never
    // hit this; this repo's newer template adds one, hence the fix here.
    manifestSrc: ['self'],
    generateNonces: false
  }
}

export { contentSecurityPolicy }
