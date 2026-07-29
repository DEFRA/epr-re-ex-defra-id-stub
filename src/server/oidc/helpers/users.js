import {
  findRegistrations,
  findRegistrationByEmail
} from '#/server/registration/helpers/find-registration.js'
import { createLogger } from '#/server/common/helpers/logging/logger.js'

const logger = createLogger()

async function findAllUsers(store) {
  const registrations = await findRegistrations(store)
  logger.info({ registrations }, 'Found registrations')
  const users = registrations.map((registration) => {
    return {
      username: registration.email,
      email: registration.email,
      id: registration.userId
    }
  })
  return users
}

async function findUser(user, store) {
  const registration = await findRegistrationByEmail(user, store)
  if (registration) {
    return registration
  }
}

// Temporary (ephemeral) registrations only - used to build the login page's
// "available users" hint, which must never advertise permanent
// (data/<env>/users.json) users' emails.
async function findTemporaryUsers(store) {
  const registrations = await store.listEphemeralRegistrations()
  return registrations.map((registration) => {
    return {
      username: registration.email,
      email: registration.email,
      id: registration.userId
    }
  })
}

export { findAllUsers, findTemporaryUsers, findUser }
