import { oidcBasePath } from '#/server/oidc/oidc-config.js'

const oidcParamNames = [
  'client_id',
  'response_type',
  'redirect_uri',
  'state',
  'scope',
  'nonce',
  'code_challenge',
  'code_challenge_method',
  'forceReselection',
  'serviceId'
]

function buildHiddenFields(oidcParams) {
  return oidcParamNames
    .filter((name) => oidcParams[name] !== undefined)
    .map((name) => ({ name, value: oidcParams[name] }))
}

const renderLoginPage = async (
  h,
  {
    oidcParams = {},
    allUsers = [],
    email,
    formErrors = {},
    newRegistrationLink
  } = {}
) => {
  return h.view('oidc/views/login', {
    pageTitle: 'DEFRA ID Login',
    heading: 'DEFRA ID Login',
    action: `${oidcBasePath}/login`,
    hiddenFields: buildHiddenFields(oidcParams),
    availableEmails: allUsers.map((user) => user.email),
    newRegistrationLink,
    email,
    formErrors
  })
}

export { renderLoginPage }
