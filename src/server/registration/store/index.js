import fs from 'node:fs'

import { createLogger } from '#/server/common/helpers/logging/logger.js'
import { usersFileValidation } from '#/server/registration/helpers/schemas/users-file-validation.js'
import { CombinedRegistrationsStore } from '#/server/registration/store/combined-store.js'
import { createDynamoDbDocumentClient } from '#/server/registration/store/dynamodb-client.js'
import { FileUsersStore } from '#/server/registration/store/file-store.js'
import { DynamoDbRegistrationsStore } from '#/server/registration/store/registrations-store.js'
import { MemoryRegistrationsStore } from '#/server/registration/store/memory-store.js'

const logger = createLogger()

function loadPermanentUsersStore(config) {
  const filePath = config.get('usersFile')

  const raw = fs.readFileSync(filePath, 'utf-8')
  const users = JSON.parse(raw)

  const { error, value } = usersFileValidation.validate(users, {
    abortEarly: false
  })

  if (error) {
    throw new Error(`Invalid users file at ${filePath}: ${error.message}`)
  }

  logger.info(
    { filePath, count: value.length },
    'Loaded permanent users from file'
  )

  return new FileUsersStore(value)
}

function createEphemeralStore(config) {
  const engine = config.get('registrationsStore.engine')

  if (engine === 'memory') {
    const reason = process.env.REGISTRATIONS_STORE_ENGINE
      ? 'REGISTRATIONS_STORE_ENGINE=memory'
      : 'REGISTRATIONS_STORE_ENGINE not set, defaulting to memory'
    logger.info(reason, 'Using in-memory ephemeral registrations store')
    return new MemoryRegistrationsStore({
      ttlMs: config.get('registrationsStore.ttl')
    })
  }

  logger.info('Using DynamoDB ephemeral registrations store')
  const endpoint = config.get('aws.dynamoDb.endpoint')
  if (endpoint) {
    logger.warn({ endpoint }, 'DynamoDB custom endpoint configured')
  }
  const client = createDynamoDbDocumentClient({
    endpoint,
    region: config.get('aws.region')
  })

  return new DynamoDbRegistrationsStore({
    client,
    tableName: config.get('dynamoDb.registrationsTableName'),
    ttlMs: config.get('registrationsStore.ttl')
  })
}

function createRegistrationsStore(config) {
  const permanentStore = loadPermanentUsersStore(config)
  const ephemeralStore = createEphemeralStore(config)

  return new CombinedRegistrationsStore({ permanentStore, ephemeralStore })
}

export { createRegistrationsStore }
