import { CombinedRegistrationsStore } from '#/server/registration/store/combined-store.js'
import { FileUsersStore } from '#/server/registration/store/file-store.js'
import { MemoryRegistrationsStore } from '#/server/registration/store/memory-store.js'

const permanentUsers = [
  {
    userId: 'permanent-1',
    email: 'permanent@example.com',
    organisationId: 'perm-org-1'
  }
]

function buildStore() {
  return new CombinedRegistrationsStore({
    permanentStore: new FileUsersStore(permanentUsers),
    ephemeralStore: new MemoryRegistrationsStore()
  })
}

describe('CombinedRegistrationsStore', () => {
  test('reads a permanent registration by userId', async () => {
    const store = buildStore()

    await expect(store.getRegistration('permanent-1')).resolves.toMatchObject({
      email: 'permanent@example.com'
    })
  })

  test('reads a temporary registration by userId after it is created', async () => {
    const store = buildStore()
    await store.putRegistration('temp-1', {
      userId: 'temp-1',
      email: 'temp@example.com'
    })

    await expect(store.getRegistration('temp-1')).resolves.toMatchObject({
      email: 'temp@example.com'
    })
  })

  test('lists both permanent and temporary registrations', async () => {
    const store = buildStore()
    await store.putRegistration('temp-1', {
      userId: 'temp-1',
      email: 'temp@example.com'
    })

    const result = await store.listRegistrations()

    expect(result).toHaveLength(2)
    expect(result.map((r) => r.email).sort()).toEqual([
      'permanent@example.com',
      'temp@example.com'
    ])
  })

  test('listEphemeralRegistrations only lists temporary registrations', async () => {
    const store = buildStore()
    await store.putRegistration('temp-1', {
      userId: 'temp-1',
      email: 'temp@example.com'
    })

    const result = await store.listEphemeralRegistrations()

    expect(result).toEqual([
      expect.objectContaining({ userId: 'temp-1', email: 'temp@example.com' })
    ])
  })

  test('finds by email across both stores, permanent taking precedence', async () => {
    const store = buildStore()
    await store.putRegistration('temp-1', {
      userId: 'temp-1',
      email: 'temp@example.com'
    })

    await expect(
      store.findRegistrationByEmail('permanent@example.com')
    ).resolves.toMatchObject({ userId: 'permanent-1' })
    await expect(
      store.findRegistrationByEmail('temp@example.com')
    ).resolves.toMatchObject({ userId: 'temp-1' })
  })

  test('mutations only ever affect the ephemeral store', async () => {
    const store = buildStore()
    await store.putRegistration('temp-1', {
      userId: 'temp-1',
      email: 'temp@example.com'
    })
    await store.deleteRegistration('temp-1')

    await expect(store.getRegistration('temp-1')).resolves.toBeUndefined()
    await expect(store.getRegistration('permanent-1')).resolves.toBeDefined()
  })

  test('relationships are read from whichever store owns the userId', async () => {
    const store = buildStore()
    await store.putRegistration('temp-1', {
      userId: 'temp-1',
      email: 'temp@example.com'
    })
    await store.putRelationship('temp-1', 'temp-rel-1', {
      relationshipId: 'temp-rel-1',
      organisationName: 'Temp Org'
    })

    const permanentRelationships = await store.listRelationships('permanent-1')
    expect(permanentRelationships).toHaveLength(1)
    expect(permanentRelationships[0]).toMatchObject({
      organisationId: 'perm-org-1'
    })

    await expect(
      store.getRelationship(
        'permanent-1',
        permanentRelationships[0].relationshipId
      )
    ).resolves.toEqual(permanentRelationships[0])
    await expect(
      store.getRelationship('temp-1', 'temp-rel-1')
    ).resolves.toMatchObject({ organisationName: 'Temp Org' })
  })

  test('isPermanentUserEmail is true only for permanent users', async () => {
    const store = buildStore()
    await store.putRegistration('temp-1', {
      userId: 'temp-1',
      email: 'temp@example.com'
    })

    await expect(
      store.isPermanentUserEmail('permanent@example.com')
    ).resolves.toBe(true)
    await expect(store.isPermanentUserEmail('temp@example.com')).resolves.toBe(
      false
    )
  })

  describe('isEmailTaken', () => {
    test('is true for a permanent user email', async () => {
      const store = buildStore()

      await expect(store.isEmailTaken('permanent@example.com')).resolves.toBe(
        true
      )
    })

    test('is true for an existing temporary registration email', async () => {
      const store = buildStore()
      await store.putRegistration('temp-1', {
        userId: 'temp-1',
        email: 'temp@example.com'
      })

      await expect(store.isEmailTaken('temp@example.com')).resolves.toBe(true)
    })

    test('is false for a free email', async () => {
      const store = buildStore()

      await expect(store.isEmailTaken('free@example.com')).resolves.toBe(false)
    })

    test('is false when the only match is excludingUserId', async () => {
      const store = buildStore()
      await store.putRegistration('temp-1', {
        userId: 'temp-1',
        email: 'temp@example.com'
      })

      await expect(
        store.isEmailTaken('temp@example.com', { excludingUserId: 'temp-1' })
      ).resolves.toBe(false)
    })
  })
})
