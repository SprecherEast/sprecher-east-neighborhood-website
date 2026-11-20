import { beforeEach, describe, expect, it, vi } from 'vitest'

// The use case is replaced: this tests what the action does with its input
const useCases = vi.hoisted(() => ({ removePasskey: vi.fn() }))
vi.mock('./use-cases/removePasskey', () => useCases)
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', async (importActual) => ({ ...(await importActual<object>()) }))
vi.mock('@payloadcms/next/auth', () => ({ login: vi.fn() }))

import { removePasskey } from './actions'

beforeEach(() => {
  useCases.removePasskey.mockReset().mockResolvedValue({ ok: true })
})

describe('removePasskey', () => {
  it('parses the input again and passes on only the passkey’s id', async () => {
    expect(await removePasskey({ passkeyId: 12, accountId: 8, userId: 8 })).toEqual({ ok: true })
    expect(useCases.removePasskey).toHaveBeenCalledExactlyOnceWith({ passkeyId: 12 })
  })

  it('hands on what the use case answers, such as a request to log in again', async () => {
    useCases.removePasskey.mockResolvedValue({ ok: false, failure: 'sign-in-again' })
    expect(await removePasskey({ passkeyId: 12 })).toEqual({ ok: false, failure: 'sign-in-again' })
  })

  it.each([
    ['nothing', undefined],
    ['text', 'hello'],
    ['no id', {}],
    ['an id as text', { passkeyId: '12' }],
    ['zero', { passkeyId: 0 }],
    ['a negative id', { passkeyId: -3 }],
    ['a fraction', { passkeyId: 1.5 }],
    ['an operator object', { passkeyId: { not_equals: 0 } }],
    ['an account without an id', { accountId: 7 }],
  ])('refuses %s with the one failure, calling nothing', async (_name, input) => {
    expect(await removePasskey(input)).toEqual({ ok: false, failure: 'failed' })
    expect(useCases.removePasskey).not.toHaveBeenCalled()
  })
})
