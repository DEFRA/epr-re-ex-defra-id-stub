import convict from 'convict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import convictFormatWithValidator from 'convict-format-with-validator'

const dirname = path.dirname(fileURLToPath(import.meta.url))

const fourHoursMs = 14400000
const oneWeekMs = 604800000
const oneDayMs = 86400000
const threeDaysMs = oneDayMs * 3

const isProduction = process.env.NODE_ENV === 'production'
const isTest = process.env.NODE_ENV === 'test'
const isDevelopment = process.env.NODE_ENV === 'development'

// Picks which data/<usersEnv>/users.json to load permanent stub users from -
// distinct from NODE_ENV, which stays production/development/test regardless
// of which deployed CDP environment (test, ext-test, prod, ...) this is.
const usersEnv = process.env.USERS_ENV ?? 'local'

convict.addFormats(convictFormatWithValidator)

export const config = convict({
  serviceVersion: {
    doc: 'The service version, this variable is injected into your docker container in CDP environments',
    format: String,
    nullable: true,
    default: null,
    env: 'SERVICE_VERSION'
  },
  host: {
    doc: 'The IP address to bind',
    format: 'ipaddress',
    default: '0.0.0.0',
    env: 'HOST'
  },
  port: {
    doc: 'The port to bind.',
    format: 'port',
    default: 3000,
    env: 'PORT'
  },
  staticCacheTimeout: {
    doc: 'Static cache timeout in milliseconds',
    format: Number,
    default: oneWeekMs,
    env: 'STATIC_CACHE_TIMEOUT'
  },
  serviceName: {
    doc: 'Applications Service Name',
    format: String,
    default: 'epr-re-ex-defra-id-stub'
  },
  root: {
    doc: 'Project root',
    format: String,
    default: path.resolve(dirname, '../..')
  },
  assetPath: {
    doc: 'Asset path',
    format: String,
    default: '/public',
    env: 'ASSET_PATH'
  },
  isProduction: {
    doc: 'If this application running in the production environment',
    format: Boolean,
    default: isProduction
  },
  isDevelopment: {
    doc: 'If this application running in the development environment',
    format: Boolean,
    default: isDevelopment
  },
  isTest: {
    doc: 'If this application running in the test environment',
    format: Boolean,
    default: isTest
  },
  log: {
    enabled: {
      doc: 'Is logging enabled',
      format: Boolean,
      default: process.env.NODE_ENV !== 'test',
      env: 'LOG_ENABLED'
    },
    level: {
      doc: 'Logging level',
      format: ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'],
      default: 'info',
      env: 'LOG_LEVEL'
    },
    format: {
      doc: 'Format to output logs in.',
      format: ['ecs', 'pino-pretty'],
      default: isProduction ? 'ecs' : 'pino-pretty',
      env: 'LOG_FORMAT'
    },
    redact: {
      doc: 'Log paths to redact',
      format: Array,
      default: isProduction
        ? ['req.headers.authorization', 'req.headers.cookie', 'res.headers']
        : [],
      env: 'LOG_REDACT'
    }
  },
  httpProxy: {
    doc: 'HTTP Proxy',
    format: String,
    nullable: true,
    default: null,
    env: 'HTTP_PROXY'
  },
  isSecureContextEnabled: {
    doc: 'Enable Secure Context',
    format: Boolean,
    default: isProduction,
    env: 'ENABLE_SECURE_CONTEXT'
  },
  session: {
    cache: {
      engine: {
        doc: 'backend cache is written to',
        format: ['redis', 'memory'],
        default: isProduction ? 'redis' : 'memory',
        env: 'SESSION_CACHE_ENGINE'
      },
      name: {
        doc: 'server side session cache name',
        format: String,
        default: 'session',
        env: 'SESSION_CACHE_NAME'
      },
      ttl: {
        doc: 'server side session cache ttl',
        format: Number,
        default: fourHoursMs,
        env: 'SESSION_CACHE_TTL'
      }
    },
    cookie: {
      ttl: {
        doc: 'Session cookie ttl',
        format: Number,
        default: fourHoursMs,
        env: 'SESSION_COOKIE_TTL'
      },
      password: {
        doc: 'session cookie password',
        format: String,
        default: 'the-password-must-be-at-least-32-characters-long',
        env: 'SESSION_COOKIE_PASSWORD',
        sensitive: true
      },
      secure: {
        doc: 'set secure flag on cookie',
        format: Boolean,
        default: isProduction,
        env: 'SESSION_COOKIE_SECURE'
      }
    }
  },
  redis: {
    host: {
      doc: 'Redis cache host',
      format: String,
      default: '127.0.0.1',
      env: 'REDIS_HOST'
    },
    username: {
      doc: 'Redis cache username',
      format: String,
      default: '',
      env: 'REDIS_USERNAME'
    },
    password: {
      doc: 'Redis cache password',
      format: '*',
      default: '',
      sensitive: true,
      env: 'REDIS_PASSWORD'
    },
    keyPrefix: {
      doc: 'Redis cache key prefix name used to isolate the cached results across multiple clients',
      format: String,
      default: 'epr-re-ex-defra-id-stub:',
      env: 'REDIS_KEY_PREFIX'
    },
    useSingleInstanceCache: {
      doc: 'Connect to a single instance of redis instead of a cluster.',
      format: Boolean,
      default: !isProduction,
      env: 'USE_SINGLE_INSTANCE_CACHE'
    },
    useTLS: {
      doc: 'Connect to redis using TLS',
      format: Boolean,
      default: isProduction,
      env: 'REDIS_TLS'
    }
  },
  nunjucks: {
    watch: {
      doc: 'Reload templates when they are changed.',
      format: Boolean,
      default: isDevelopment
    },
    noCache: {
      doc: 'Use a cache and recompile templates each time',
      format: Boolean,
      default: isDevelopment
    }
  },
  tracing: {
    header: {
      doc: 'Which header to track',
      format: String,
      default: 'x-cdp-request-id',
      env: 'TRACING_HEADER'
    }
  },
  appBaseUrl: {
    doc: 'Application base URL for after we login',
    format: String,
    default: 'http://localhost:3000',
    env: 'APP_BASE_URL'
  },
  usersEnv: {
    doc: 'Name of the data/<name>/users.json folder permanent stub users are loaded from, unless usersFile/USERS_FILE_PATH overrides it with an absolute path.',
    format: String,
    default: usersEnv,
    env: 'USERS_ENV'
  },
  usersFile: {
    doc: 'Path to the JSON file of permanent stub users (email/organisationId/profile). Defaults to data/<USERS_ENV>/users.json; set USERS_FILE_PATH to override with a specific file.',
    format: String,
    default: path.resolve(dirname, `../../data/${usersEnv}/users.json`),
    env: 'USERS_FILE_PATH'
  },
  registrationsStore: {
    engine: {
      doc: 'Ephemeral (temporary) registration store backend',
      format: ['dynamodb', 'memory'],
      default: process.env.REGISTRATIONS_STORE_ENGINE ?? 'memory',
      env: 'REGISTRATIONS_STORE_ENGINE'
    },
    ttl: {
      doc: 'Ephemeral registration store item TTL in milliseconds',
      format: Number,
      default: threeDaysMs,
      env: 'REGISTRATIONS_STORE_TTL'
    }
  },
  aws: {
    region: {
      doc: 'AWS region for DynamoDB access',
      format: String,
      default: 'eu-west-2',
      env: 'AWS_REGION'
    },
    dynamoDb: {
      endpoint: {
        doc: 'DynamoDB endpoint for local development',
        format: String,
        default: isProduction ? null : 'http://127.0.0.1:4566',
        nullable: true,
        env: 'DYNAMODB_ENDPOINT'
      }
    }
  },
  dynamoDb: {
    registrationsTableName: {
      doc: 'Registrations DynamoDB table name',
      format: String,
      default: 'epr-re-ex-defra-id-stub-registrations',
      env: 'AWS_DYNAMODB_REGISTRATIONS_TABLE_NAME'
    }
  },
  oidc: {
    baseUrl: {
      doc: 'Application base URL for OIDC config if different from APP_BASE_URL',
      format: String,
      default: null,
      nullable: true,
      env: 'OIDC_APP_BASE_URL'
    },
    stubInternalUrl: {
      doc: 'Internal base URL for server-to-server OIDC endpoints (token, jwks, userinfo, issuer) and the token issuer. Defaults to the external base. Set this to the in-network stub URL when the external base is a per-stack localhost URL the browser uses.',
      format: String,
      default: null,
      nullable: true,
      env: 'STUB_INTERNAL_URL'
    },
    basePath: {
      doc: 'the base path all oidc stubs will be served from',
      format: String,
      default: '/epr-re-ex-defra-id-stub',
      env: 'OIDC_BASE_PATH'
    },
    clientId: {
      doc: 'client id to use in the oidc stub',
      format: String,
      default: '63983fc2-cfff-45bb-8ec2-959e21062b9a',
      env: 'OIDC_CLIENT_ID'
    },
    clientSecret: {
      doc: 'the client secret key for the oidc stub',
      format: String,
      default: 'test_value',
      env: 'OIDC_CLIENT_SECRET'
    },
    publicKeyBase64: {
      doc: 'base 64 encoded public pem',
      format: String,
      default: undefined,
      env: 'OIDC_PUBLIC_KEY_B64'
    },
    privateKeyBase64: {
      doc: 'base 64 encoded private pem',
      format: String,
      default: undefined,
      env: 'OIDC_PRIVATE_KEY_B64'
    },
    showLogin: {
      doc: 'if set, shows login page, else it auto logs in as admin',
      format: Boolean,
      default: true,
      env: 'OIDC_SHOW_LOGIN'
    }
  }
})

config.validate({ allowed: 'strict' })
