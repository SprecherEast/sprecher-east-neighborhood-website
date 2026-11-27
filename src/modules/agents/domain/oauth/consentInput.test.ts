import { describe, expect, it } from 'vitest'

import { consentInputSchema } from './consentInput'

const valid = {
  request: {
    clientId: 'mcp_abc',
    redirectUri: 'https://claude.ai/cb',
    state: 's',
    codeChallenge: 'a'.repeat(43),
    resource: 'https://sprechereast.com/api/mcp',
    scope: 'mcp',
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
