import Joi from 'joi'

const usersFileValidation = Joi.array()
  .items(
    Joi.object({
      userId: Joi.string().uuid().required(),
      email: Joi.string().email().required(),
      organisationId: Joi.string().optional(),
      loa: Joi.string().optional(),
      aal: Joi.string().optional(),
      enrolmentCount: Joi.number().integer().positive().optional(),
      enrolmentRequestCount: Joi.number().integer().positive().optional()
    })
  )
  .unique('userId')
  .unique((a, b) => a.email.toLowerCase() === b.email.toLowerCase())
  .unique('organisationId', { ignoreUndefined: true })
  .messages({
    'array.unique':
      'Duplicate {#dupePos} found - userId, email and organisationId must each be unique'
  })

export { usersFileValidation }
