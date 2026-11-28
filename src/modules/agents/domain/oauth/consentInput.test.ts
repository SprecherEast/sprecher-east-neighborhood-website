import { describe, expect, it } from 'vitest'

import { REQUEST_LIMITS } from './authorizeRequest'
import { consentInputSchema } from './consentInput'

const valid = {
  request: {
    clientId: 'mcp_abc',
    redirectUri: 'https://claude.ai/cb',
    state: 's',
    codeChallenge: 'a'.repeat(43),
    resource: 'https://sprechereast.com/api/mcp',
    scope: 'read',
  },
  ticket: '123.abc',
  decision: 'approve',
}

describe('consentInputSchema', () => {
  it('accepts an approval and a denial', () => {
    expect(consentInputSchema.safeParse(valid).success).toBe(true)
    expect(consentInputSchema.safeParse({ ...valid, decision: 'deny' }).success).toBe(true)
  })

  it.each([
    ['another decision', { decision: 'maybe' }],
    ['no ticket', { ticket: '' }],
    ['a huge ticket', { ticket: 'x'.repeat(201) }],
    ['a number for the request', { request: 5 }],
    ['no request', { request: undefined }],
  ])('refuses %s', (_name, over) => {
    expect(consentInputSchema.safeParse({ ...valid, ...over }).success).toBe(false)
  })

  it('refuses a request field that is missing, too long or not text', () => {
    for (const field of Object.keys(valid.request)) {
      const gone = { ...valid.request, [field]: undefined }
      const long = { ...valid.request, [field]: 'x'.repeat(5000) }
      const number = { ...valid.request, [field]: 7 }
      for (const request of [gone, long, number]) {
        expect(consentInputSchema.safeParse({ ...valid, request }).success).toBe(false)
      }
    }
  })

  it('drops a field the caller adds', () => {
    const parsed = consentInputSchema.parse({ ...valid, admin: true })
    expect(parsed).not.toHaveProperty('admin')
  })
})

describe('the request limits', () => {
  // The approval page shows what `readAuthorizeRequest` accepted, so this schema must take
  // exactly the same sizes or a shown request could not be approved
  const parse = (over: Record<string, string>) =>
    consentInputSchema.safeParse({ ...valid, request: { ...valid.request, ...over } }).success

  it.each([
    ['clientId', REQUEST_LIMITS.clientId, 1],
    ['redirectUri', REQUEST_LIMITS.redirectUri, 1],
    ['state', REQUEST_LIMITS.state, 1],
    ['codeChallenge', REQUEST_LIMITS.challenge.max, REQUEST_LIMITS.challenge.min],
  ])('take %s from its smallest to its largest size and no further', (field, max, min) => {
    expect(parse({ [field]: 'a'.repeat(max) })).toBe(true)
    expect(parse({ [field]: 'a'.repeat(max + 1) })).toBe(false)
    expect(parse({ [field]: 'a'.repeat(min) })).toBe(true)
    expect(parse({ [field]: 'a'.repeat(min - 1) })).toBe(false)
  })
})
