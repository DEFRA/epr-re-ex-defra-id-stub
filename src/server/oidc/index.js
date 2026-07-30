import { config } from '#/config/config.js'
import {
  authorizeController,
  loginController,
  loginSubmitController
} from '#/server/oidc/controllers/authorize-controller.js'
import { logoutController } from '#/server/oidc/controllers/logout-controller.js'
import {
  selectOrganisationController,
  showOrganisationPickerController
} from '#/server/oidc/controllers/organisation-controller.js'
import { tokenController } from '#/server/oidc/controllers/token-controller.js'
import { userInfoController } from '#/server/oidc/controllers/user-info-controller.js'
import { jwksController } from '#/server/oidc/controllers/well-known-jwks.js'
import { openIdConfigurationController } from '#/server/oidc/controllers/well-known-openid-configuration.js'
import {
  getOrCreateSharedKeypair,
  loadKeyPair
} from '#/server/oidc/helpers/oidc-crypto.js'
import { initSessionStore } from '#/server/oidc/helpers/session-store.js'
import { oidcBasePath, oidcConfig } from '#/server/oidc/oidc-config.js'

const oidc = {
  plugin: {
    name: 'oidc',
    register: async (server) => {
      // getOrCreateSharedKeypair reads/writes the cache, which requires the
      // cache client's connection to be started - that only happens once
      // server.initialize()/start() runs, so this must wait for onPreStart
      // rather than resolving keys directly during plugin registration.
      server.ext('onPreStart', async (srv) => {
        const cfgPubKey = config.get('oidc.publicKeyBase64')
        const cfgPrivKey = config.get('oidc.privateKeyBase64')

        let keys
        if (cfgPubKey && cfgPrivKey) {
          srv.logger.info('loading keys from config')
          keys = loadKeyPair(
            Buffer.from(cfgPubKey, 'base64'),
            Buffer.from(cfgPrivKey, 'base64')
          )
        } else {
          srv.logger.info('loading or generating shared keys')
          keys = await getOrCreateSharedKeypair(srv)
        }
        srv.decorate('server', 'keys', keys)
        srv.decorate('request', 'keys', keys)
      })

      // Sessions must outlive refresh tokens - once a refresh token's
      // backing session is evicted, refreshing fails.
      initSessionStore(server, oidcConfig.refreshTtl * 1000)

      server.route([
        {
          method: 'GET',
          path: `${oidcBasePath}/.well-known/openid-configuration`,
          ...openIdConfigurationController
        },
        {
          method: 'GET',
          path: `${oidcBasePath}/.well-known/jwks.json`,
          ...jwksController
        },
        {
          method: 'GET',
          path: `${oidcBasePath}/authorize`,
          ...authorizeController
        },
        {
          method: 'GET',
          path: `${oidcBasePath}/login`,
          ...loginController
        },
        {
          method: 'POST',
          path: `${oidcBasePath}/login`,
          ...loginSubmitController
        },
        {
          method: 'GET',
          path: `${oidcBasePath}/organisations`,
          ...showOrganisationPickerController
        },
        {
          method: 'POST',
          path: `${oidcBasePath}/organisations`,
          ...selectOrganisationController
        },
        {
          method: 'POST',
          path: `${oidcBasePath}/token`,
          ...tokenController
        },
        {
          method: 'GET',
          path: `${oidcBasePath}/user-info`,
          ...userInfoController
        },
        {
          method: 'GET',
          path: `${oidcBasePath}/logout`,
          ...logoutController
        }
      ])
    }
  }
}

export { oidc }
