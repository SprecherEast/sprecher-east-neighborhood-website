import { describe, expect, it } from 'vitest'

import { OAUTH_ERROR_NAMES } from './constants'

describe('OAUTH_ERROR_NAMES', () => {
  it.each([
    'invalid_request',
    'invalid_grant',
    'unsupported_grant_type',
    'invalid_scope',
    'invalid_target',
    'access_denied',
  ])('lets the standard name %s leave the site', (name) => {
    expect(OAUTH_ERROR_NAMES.has(name)).toBe(true)
  })

  it.each(['server_error', 'invalid_argument', 'SequelizeError'])(
    'does not let %s leave, which is answered as a server error',
    (name) => {
      expect(OAUTH_ERROR_NAMES.has(name)).toBe(false)
    },
  )
})
