import { describe, expect, it } from 'vitest'

import { CONNECTION_REFUSED, OAUTH_ERROR_NAMES } from './constants'

describe('OAUTH_ERROR_NAMES', () => {
  it.each([
    'invalid_request',
    'invalid_grant',
    'unsupported_grant_type',
    'unsupported_response_type',
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

describe('CONNECTION_REFUSED', () => {
  it('says the request is not valid and where to start again, which the site shows as an alert', () => {
    expect(CONNECTION_REFUSED).toMatch(/is not valid\./)
    expect(CONNECTION_REFUSED).toMatch(/Start it again from the AI tool\./)
  })
})
