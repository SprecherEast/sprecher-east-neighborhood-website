import { beforeEach, describe, expect, it, vi } from 'vitest'

// The use case is replaced: this tests what the action does with its input and the request
const useCases = vi.hoisted(() => ({ connectGoogleWithPassword: vi.fn() }))
vi.mock('./use-cases/connectGoogle', () => useCases)
const request = vi.hoisted(() => ({ headers: new Headers() }))
vi.mock('next/headers', () => ({ headers: async () => request.headers }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', async (importActual) => ({ ...(await importActual<object>()) }))
vi.mock('@payloadcms/next/auth', () => ({ login: vi.fn() }))

import { connectGoogle } from './actions'

beforeEach(() => {
  useCases.connectGoogleWithPassword.mockReset().mockResolvedValue({ ok: true })
  request.headers = new Headers({ 'x-forwarded-for': '203.0.113.9' })
})

describe('connectGoogle (#1338)', () => {
  it('passes on the password and the connection’s address, as typed', async () => {
    expect(await connectGoogle({ password: ' pass ' })).toEqual({ ok: true })
    expect(useCases.connectGoogleWithPassword).toHaveBeenCalledExactlyOnceWith(
      { password: ' pass ' },
      '203.0.113.9',
    )
  })

  it.each([
    ['nothing', undefined],
    ['an empty password', { password: '' }],
    ['a password that isn’t text', { password: 12 }],
    ['an email beside it', { password: 'x', email: 'someone@example.com' }],
    ['an account id beside it', { password: 'x', id: 1 }],
  ])('gives the one failure for %s, without calling the use case', async (_, input) => {
    expect(await connectGoogle(input)).toEqual({ ok: false, failure: 'failed' })
    expect(useCases.connectGoogleWithPassword).not.toHaveBeenCalled()
  })

  it('passes no address when the request names none', async () => {
    request.headers = new Headers()
    await connectGoogle({ password: 'x' })
    expect(useCases.connectGoogleWithPassword.mock.calls[0]?.[1]).toBeNull()
  })
})
