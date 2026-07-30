import inert from '@hapi/inert'

import { home } from '../routes/home/index.js'
import { about } from '../routes/about/index.js'
import { health } from '../routes/health/index.js'
import { serveStaticFiles } from './serve-static-files.js'
import { config } from '#/config/config.js'
import { oidc } from '#/server/oidc/index.js'
import { registration } from '#/server/registration/index.js'

export const router = {
  plugin: {
    name: 'router',
    async register(server) {
      await server.register([inert])

      // Health-check route. Used by platform to check if service is running, do not remove!
      await server.register([health])

      // Application specific routes, add your own routes here
      await server.register([home, about, oidc, registration])

      // Static assets
      let viteMiddleware
      if (config.get('isDevelopment')) {
        try {
          const createViteServer = (await import('vite')).createServer
          const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'custom'
          })
          viteMiddleware = vite.middlewares
        } catch (error) {
          if (error.code !== 'ERR_MODULE_NOT_FOUND') {
            throw error
          }
          // vite/@defra/hapi-connect are devDependencies, absent from
          // production-built images. Fall back to serving pre-built assets.
        }
      }

      if (viteMiddleware) {
        await server.register({
          plugin: (await import('@defra/hapi-connect')).default,
          options: {
            path: '/public',
            middleware: [viteMiddleware]
          }
        })
      } else {
        server.register(serveStaticFiles)
      }
    }
  }
}
