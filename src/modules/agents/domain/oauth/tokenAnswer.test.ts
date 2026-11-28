import { describe, expect, it } from 'vitest'

import { NO_STORE_HEADERS } from './constants'
import { tokenError } from './tokenAnswer'

describe('tokenError', () => {
  it('is an RFC 6749 error body that nothing may cache', () => {
    expect(tokenError(400, 'invalid_request', 'Why.')).toEqual({
      status: 400,
      headers: NO_STORE_HEADERS,
      body: { error: 'invalid_request', error_description: 'Why.' },
    })
  })
})
