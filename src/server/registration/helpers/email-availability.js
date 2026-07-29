async function checkEmailAvailability(email, store, { excludingUserId } = {}) {
  const isTaken = await store.isEmailTaken(email, { excludingUserId })
  if (!isTaken) {
    return null
  }

  return {
    details: [
      {
        path: ['email'],
        message: 'Email address already in use'
      }
    ]
  }
}

export { checkEmailAvailability }
