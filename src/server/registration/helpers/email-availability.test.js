import { checkEmailAvailability } from '#/server/registration/helpers/email-availability.js'

describe('#checkEmailAvailability', () => {
  test('returns null when the email is free', async () => {
    const store = { isEmailTaken: vi.fn(() => false) }

    const result = await checkEmailAvailability('free@example.com', store)

    expect(result).toBeNull()
    expect(store.isEmailTaken).toHaveBeenCalledWith('free@example.com', {
      excludingUserId: undefined
    })
  })

  test('returns a Joi-shaped error when the email is taken', async () => {
    const store = { isEmailTaken: vi.fn(() => true) }

    const result = await checkEmailAvailability('taken@example.com', store)

    expect(result).toEqual({
      details: [
        {
          path: ['email'],
          message: 'Email address already in use'
        }
      ]
    })
  })

  test('passes excludingUserId through to the store', async () => {
    const store = { isEmailTaken: vi.fn(() => false) }

    await checkEmailAvailability('person@example.com', store, {
      excludingUserId: 'user-1'
    })

    expect(store.isEmailTaken).toHaveBeenCalledWith('person@example.com', {
      excludingUserId: 'user-1'
    })
  })
})
