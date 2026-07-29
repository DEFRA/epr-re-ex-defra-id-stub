import { FileUsersStore } from '#/server/registration/store/file-store.js'

const users = [
  {
    userId: 'user-1',
    email: 'person@example.com',
    organisationId: 'org-1'
  },
  {
    userId: 'user-2',
    email: 'norel@example.com'
  }
]

describe('FileUsersStore', () => {
  test('gets a registration by userId, with generated and defaulted profile fields', async () => {
    const store = new FileUsersStore(users)

    await expect(store.getRegistration('user-1')).resolves.toMatchObject({
      userId: 'user-1',
      email: 'person@example.com',
      firstName: 'Test',
      lastName: 'User',
      loa: '1',
      aal: '1',
      enrolmentCount: 1,
      enrolmentRequestCount: 1
    })
  })

  test('generates a relationship from organisationId', async () => {
    const store = new FileUsersStore(users)

    const relationships = await store.listRelationships('user-1')

    expect(relationships).toHaveLength(1)
    expect(relationships[0]).toMatchObject({ organisationId: 'org-1' })

    const registration = await store.getRegistration('user-1')
    expect(registration.currentRelationshipId).toEqual(
      relationships[0].relationshipId
    )
  })

  test('has no relationships when organisationId is absent', async () => {
    const store = new FileUsersStore(users)

    await expect(store.listRelationships('user-2')).resolves.toEqual([])

    const registration = await store.getRegistration('user-2')
    expect(registration.currentRelationshipId).toBeUndefined()
  })

  test('generates contactId and uniqueReference', async () => {
    const store = new FileUsersStore(users)

    const registration = await store.getRegistration('user-1')
    expect(registration.contactId).toEqual(expect.any(String))
    expect(registration.uniqueReference).toEqual(expect.any(String))
  })

  test('returns undefined for an unknown userId', async () => {
    const store = new FileUsersStore(users)

    await expect(store.getRegistration('unknown')).resolves.toBeUndefined()
  })

  test('lists all registrations', async () => {
    const store = new FileUsersStore(users)

    const result = await store.listRegistrations()

    expect(result).toHaveLength(2)
  })

  test('finds a registration by email case-insensitively', async () => {
    const store = new FileUsersStore(users)

    await expect(
      store.findRegistrationByEmail('PERSON@example.com')
    ).resolves.toMatchObject({ userId: 'user-1' })
  })

  test('lists and gets relationships for a user', async () => {
    const store = new FileUsersStore(users)

    const relationships = await store.listRelationships('user-1')
    const relationshipId = relationships[0].relationshipId

    await expect(
      store.getRelationship('user-1', relationshipId)
    ).resolves.toEqual(relationships[0])
  })

  test('never expires registrations', async () => {
    const store = new FileUsersStore(users)

    await expect(store.getRegistration('user-1')).resolves.toBeDefined()
  })
})
