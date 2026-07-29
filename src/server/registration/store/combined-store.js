class CombinedRegistrationsStore {
  constructor({ permanentStore, ephemeralStore }) {
    this.permanentStore = permanentStore
    this.ephemeralStore = ephemeralStore
  }

  async #isPermanentUser(userId) {
    return Boolean(await this.permanentStore.getRegistration(userId))
  }

  async getRegistration(userId) {
    const permanent = await this.permanentStore.getRegistration(userId)
    if (permanent) {
      return permanent
    }
    return this.ephemeralStore.getRegistration(userId)
  }

  async listRegistrations() {
    const [permanent, ephemeral] = await Promise.all([
      this.permanentStore.listRegistrations(),
      this.ephemeralStore.listRegistrations()
    ])
    return [...permanent, ...ephemeral]
  }

  // Temporary (ephemeral) registrations only - deliberately excludes
  // permanent data/<env>/users.json users, who should never be advertised on the
  // login page (their emails are fixed, out-of-band knowledge).
  async listEphemeralRegistrations() {
    return this.ephemeralStore.listRegistrations()
  }

  async findRegistrationByEmail(email) {
    const permanent = await this.permanentStore.findRegistrationByEmail(email)
    if (permanent) {
      return permanent
    }
    return this.ephemeralStore.findRegistrationByEmail(email)
  }

  async getRelationship(userId, relationshipId) {
    return (await this.#isPermanentUser(userId))
      ? this.permanentStore.getRelationship(userId, relationshipId)
      : this.ephemeralStore.getRelationship(userId, relationshipId)
  }

  async listRelationships(userId) {
    return (await this.#isPermanentUser(userId))
      ? this.permanentStore.listRelationships(userId)
      : this.ephemeralStore.listRelationships(userId)
  }

  // Temporary registrations are the only ones ever created/edited through
  // the registration flow - permanent users only ever come from the file
  // store, so mutations always target the ephemeral store.
  async putRegistration(userId, registration) {
    return this.ephemeralStore.putRegistration(userId, registration)
  }

  async deleteRegistration(userId) {
    return this.ephemeralStore.deleteRegistration(userId)
  }

  async putRelationship(userId, relationshipId, relationship) {
    return this.ephemeralStore.putRelationship(
      userId,
      relationshipId,
      relationship
    )
  }

  async deleteRelationship(userId, relationshipId) {
    return this.ephemeralStore.deleteRelationship(userId, relationshipId)
  }

  async deleteAllRelationships(userId) {
    return this.ephemeralStore.deleteAllRelationships(userId)
  }

  // True if email belongs to a permanent (data/<env>/users.json) user - temporary
  // registrations must never be allowed to shadow one of these.
  async isPermanentUserEmail(email) {
    return Boolean(await this.permanentStore.findRegistrationByEmail(email))
  }

  // True if email is already in use by any registration (permanent or
  // ephemeral) other than excludingUserId.
  async isEmailTaken(email, { excludingUserId } = {}) {
    const existing = await this.findRegistrationByEmail(email)
    if (!existing) {
      return false
    }
    return existing.userId !== excludingUserId
  }
}

export { CombinedRegistrationsStore }
