import * as crypto from 'crypto'
import { generateDefraIdToken } from '#/server/oidc/helpers/generate-defraid-token.js'
import jsonwebtoken from 'jsonwebtoken'
import { jwk2pem } from 'pem-jwk'
import { createLogger } from '#/server/common/helpers/logging/logger.js'
import { config } from '#/config/config.js'

const logger = createLogger()

const tenYearsMs = 10 * 365 * 24 * 60 * 60 * 1000

function loadKeyPair(pub, priv) {
  const privatePem = crypto.createPrivateKey({
    key: priv,
    format: 'pem',
    encoding: 'utf8'
  })

  const publicPem = crypto.createPublicKey({
    key: pub,
    format: 'pem',
    encoding: 'utf8'
  })

  const pem = {
    publicKey: publicPem,
    privateKey: privatePem
  }

  const jwk = {
    publicKey: pem.publicKey.export({ format: 'jwk' }),
    privatePem: pem.privateKey.export({ format: 'jwk' })
  }

  const keyId = sha256(publicPem.export({ type: 'spki', format: 'der' }))

  return {
    jwk,
    keyId,
    pem
  }
}

function generateRandomKeypair() {
  const jwk = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048, // 2048 bits is recommended for RSA keys
    publicKeyEncoding: {
      type: 'spki',
      format: 'jwk'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'jwk'
    }
  })

  const pem = {
    publicKey: jwk2pem(jwk.publicKey),
    privateKey: jwk2pem(jwk.privateKey)
  }
  const keyId = keyID(pem.publicKey)
  return {
    jwk,
    keyId,
    pem
  }
}

// The cache engine wraps an externally-managed ioredis client (see
// cache-engine.js), so catbox's cache.client.start() returns as soon as the
// client object exists - it does not wait for the connection to actually
// reach 'ready'. Reads this early in the server lifecycle (onPreStart) can
// therefore race ahead of the real handshake and throw Boom 'Disconnected'.
// Retry for a few seconds rather than assuming the first attempt succeeds.
async function withCacheRetry(fn, { attempts = 20, delayMs = 250 } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn()
    } catch (err) {
      if (attempt === attempts) {
        throw err
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
}

// Generates a random keypair on first boot and shares it across replicas
// (and restarts) via the same cache backend as the yar/oidc session state -
// without this, every pod would sign with its own key and clients verifying
// against a different pod's JWKS endpoint would fail signature checks.
// Only used when no fixed OIDC_PUBLIC_KEY_B64/OIDC_PRIVATE_KEY_B64 is
// configured. A brief inconsistency is possible if multiple pods generate a
// keypair concurrently on a cold start before any of them have cached one -
// acceptable for a stub identity provider, and self-corrects once the cache
// is populated.
async function getOrCreateSharedKeypair(server) {
  const keyCache = server.cache({
    cache: config.get('session.cache.name'),
    segment: 'oidc-keys',
    expiresIn: tenYearsMs
  })

  const cached = await withCacheRetry(() => keyCache.get('keypair'))
  if (cached) {
    return cached
  }

  const keys = generateRandomKeypair()
  await withCacheRetry(() => keyCache.set('keypair', keys))
  return keys
}

function JWKS(keys) {
  const jwks = {
    kty: 'RSA',
    n: Buffer.from(keys.jwk.publicKey.n, 'base64').toString('base64url'),
    e: Buffer.from(keys.jwk.publicKey.e, 'base64').toString('base64url'),
    alg: 'RS256',
    use: 'sig',
    kid: keys.keyId
  }

  return {
    keys: [jwks]
  }
}

async function generateToken(keys, session, host, cache) {
  const claim = await generateDefraIdToken(session, host, cache)
  if (!claim) {
    logger.warn('No claim found')
    return null
  }
  logger.info('Claim found')

  return jsonwebtoken.sign(claim, keys.pem.privateKey, {
    algorithm: 'RS256',
    keyid: keys.keyId
  })
}

async function generateIDToken(keys, session, host, cache) {
  const claim = await generateDefraIdToken(session, host, cache)
  if (!claim) {
    logger.warn('No claim found')
    return null
  }
  claim.nonce = session.nonce
  return jsonwebtoken.sign(claim, keys.pem.privateKey, {
    algorithm: 'RS256',
    keyid: keys.keyId
  })
}

async function generateRefreshToken(keys, session, host, cache) {
  const claim = await generateDefraIdToken(session, host, cache)
  if (!claim) {
    logger.warn('No claim found')
    return null
  }
  return jsonwebtoken.sign(claim, keys.pem.privateKey, {
    algorithm: 'RS256',
    keyid: keys.keyId
  })
}

function generateCodeChallenge(method, codeVerifier) {
  switch (method) {
    case 'plain':
      return codeVerifier
    case 'S256':
      return sha256(codeVerifier)
    default:
      return null
  }
}

function keyID(pemPublicKey) {
  const publicKey = crypto.createPublicKey({
    key: pemPublicKey,
    format: 'pem',
    type: 'spki'
  })
  const publicKeyDER = publicKey.export({ type: 'spki', format: 'der' })
  return sha256(publicKeyDER)
}

function sha256(input) {
  const sha256 = crypto.createHash('sha256').update(input).digest()
  return sha256
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export {
  loadKeyPair,
  generateRandomKeypair,
  getOrCreateSharedKeypair,
  JWKS,
  generateToken,
  generateIDToken,
  generateRefreshToken,
  generateCodeChallenge,
  sha256
}
