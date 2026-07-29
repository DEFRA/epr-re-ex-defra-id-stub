import { usersFileValidation } from '#/server/registration/helpers/schemas/users-file-validation.js'

function baseUser(overrides = {}) {
  return {
    userId: '64c0a65f-b98b-4710-ba2b-c86467865bfc',
    email: 'john.doe@example.com',
    organisationId: 'org-1',
    ...overrides
  }
}

describe('usersFileValidation', () => {
  test('accepts a valid list of users', () => {
    const users = [
      baseUser(),
      baseUser({
        userId: '1555822b-1857-40b5-85e9-10e7dfdfd092',
        email: 'jane.smith@example.com',
        organisationId: 'org-2'
      })
    ]

    expect(usersFileValidation.validate(users).error).toBeUndefined()
  })

  test('accepts multiple users with no organisationId', () => {
    const users = [
      baseUser({ organisationId: undefined }),
      baseUser({
        userId: '1555822b-1857-40b5-85e9-10e7dfdfd092',
        email: 'jane.smith@example.com',
        organisationId: undefined
      })
    ]

    expect(usersFileValidation.validate(users).error).toBeUndefined()
  })

  test('rejects a duplicate userId', () => {
    const users = [
      baseUser(),
      baseUser({ email: 'other@example.com', organisationId: 'org-2' })
    ]

    expect(usersFileValidation.validate(users).error).toBeDefined()
  })

  test('rejects a duplicate email, case-insensitively', () => {
    const users = [
      baseUser(),
      baseUser({
        userId: '1555822b-1857-40b5-85e9-10e7dfdfd092',
        email: 'JOHN.DOE@example.com',
        organisationId: 'org-2'
      })
    ]

    expect(usersFileValidation.validate(users).error).toBeDefined()
  })

  test('rejects a duplicate organisationId', () => {
    const users = [
      baseUser(),
      baseUser({
        userId: '1555822b-1857-40b5-85e9-10e7dfdfd092',
        email: 'jane.smith@example.com'
      })
    ]

    expect(usersFileValidation.validate(users).error).toBeDefined()
  })
})
