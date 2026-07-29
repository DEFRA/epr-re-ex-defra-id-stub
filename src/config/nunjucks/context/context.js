import path from 'node:path'
import { readFileSync } from 'node:fs'

import { config } from '#/config/config.js'
import { buildNavigation } from './build-navigation.js'
import { createLogger } from '#/server/common/helpers/logging/logger.js'

const logger = createLogger()
const assetPath = config.get('assetPath')
const manifestPath = path.join(
  config.get('root'),
  '.public/.vite/manifest.json'
)

let viteManifest
let viteManifestLoadAttempted = false

export function context(request) {
  if (!viteManifestLoadAttempted) {
    viteManifestLoadAttempted = true
    try {
      viteManifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.error(`Vite ${path.basename(manifestPath)} not found`)
      }
    }
  }

  return {
    assetPath: `${assetPath}/assets`,
    serviceName: config.get('serviceName'),
    serviceUrl: '/',
    breadcrumbs: [],
    navigation: buildNavigation(request),
    getAssetPath(asset) {
      const viteAssetPath = viteManifest?.[asset]?.file
      if (viteAssetPath) {
        return `${assetPath}/${viteAssetPath}`
      }

      const isStylesheet = /\.s?css$/.test(asset)
      return `${assetPath}/${asset}${isStylesheet ? '?direct' : ''}`
    }
  }
}
