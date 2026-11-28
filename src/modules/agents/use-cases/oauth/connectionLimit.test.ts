import { describe, expect, it } from 'vitest'

import { OAUTH_REQUEST_LIMIT } from '../../domain/oauth/constants'
import { createConnectionLimit } from './connectionLimit'

const from = (ip?: string) => new Headers(ip ? { 'x-forwarded-for': ip } : {})

describe('createConnectionLimit', () => {
  it('lets one connection through up to the limit in a minute, then refuses it', () => {
    const allows = createConnectionLimit()
    const results = Array.from({ length: OAUTH_REQUEST_LIMIT.perConnection + 1 }, () =>
      allows(from('203.0.113.1')),
    )
    expect(results.slice(0, -1).every(Boolean)).toBe(true)
    expect(results.at(-1)).toBe(false)
  })

  it('counts each connection on its own', () => {
    const allows = createConnectionLimit()
    for (let i = 0; i < OAUTH_REQUEST_LIMIT.perConnection; i++) allows(from('203.0.113.1'))
    expect(allows(from('203.0.113.1'))).toBe(false)
    expect(allows(from('203.0.113.2'))).toBe(true)
  })

  it('counts each address on its own, so the pages do not use up the token address', () => {
    const [pages, token] = [createConnectionLimit(), createConnectionLimit()]
    for (let i = 0; i < OAUTH_REQUEST_LIMIT.perConnection + 1; i++) pages(from('203.0.113.1'))
    expect(token(from('203.0.113.1'))).toBe(true)
  })

  it('does not count a request that names no connection', () => {
    const allows = createConnectionLimit()
    const results = Array.from({ length: OAUTH_REQUEST_LIMIT.perConnection * 2 }, () =>
      allows(from()),
    )
    expect(results.every(Boolean)).toBe(true)
  })
})
