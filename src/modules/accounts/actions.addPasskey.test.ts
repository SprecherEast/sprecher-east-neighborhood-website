import { beforeEach, describe, expect, it, vi } from 'vitest'

// The use cases are replaced: this tests what the actions do with their input and the request
const useCases = vi.hoisted(() => ({ startAddPasskey: vi.fn(), finishAddPasskey: vi.fn() }))
vi.mock('./use-cases/addPasskey', () => useCases)
const request = vi.hoisted(() => ({ headers: new Headers() }))
vi.mock('next/headers', () => ({ headers: async () => request.headers }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', async (importActual) => ({ ...(await importActual<object>()) }))
vi.mock('@payloadcms/next/auth', () => ({ login: vi.fn() }))

import { addPasskey, getPasskeyOptions } from './actions'

const answer = {
  id: 'abc',
  rawId: 'abc',
  type: 'public-key',
  clientExtensionResults: {},
  response: { clientDataJSON: 'eyJ9', attestationObject: 'o2Nm', transports: ['internal'] },
}

beforeEach(() => {
  useCases.startAddPasskey.mockReset().mockResolvedValue({ ok: true, options: { challenge: 'c' } })
  useCases.finishAddPasskey.mockReset().mockResolvedValue({ ok: true })
  request.headers = new Headers()
})

describe('getPasskeyOptions', () => {
  it('takes no input and passes only the connection’s address on, never an account', async () => {
    request.headers = new Headers({ 'x-forwarded-for': '203.0.113.9' })
    expect(await getPasskeyOptions()).toEqual({ ok: true, options: { challenge: 'c' } })
    expect(useCases.startAddPasskey).toHaveBeenCalledExactlyOnceWith('203.0.113.9')
  })

  it('passes no address when the request names none', async () => {
    await getPasskeyOptions()
    expect(useCases.startAddPasskey).toHaveBeenCalledExactlyOnceWith(null)
  })
})

describe('addPasskey', () => {
  it('parses the input again and passes on only the answer and the label', async () => {
    const result = await addPasskey({ answer: { ...answer, extra: 1 }, label: 'My phone' })
    expect(result).toEqual({ ok: true })
    expect(useCases.finishAddPasskey).toHaveBeenCalledExactlyOnceWith({
      answer: { ...answer, authenticatorAttachment: undefined },
      label: 'My phone',
    })
  })

  it.each([
    ['nothing', undefined],
    ['text', 'hello'],
    ['no answer', { label: 'My phone' }],
    ['an answer of the wrong type', { answer: { ...answer, type: 'password' } }],
    ['an account named by the caller', { answer, accountId: 8 }],
    ['an account named inside the answer', { answer: { ...answer, accountId: 8 }, userId: 8 }],
    ['a label that is far too long', { answer, label: 'x'.repeat(1000) }],
  ])('refuses %s with the one failure, calling nothing', async (_name, input) => {
    expect(await addPasskey(input)).toEqual({ ok: false, failure: 'failed' })
    expect(useCases.finishAddPasskey).not.toHaveBeenCalled()
  })

  it('answers with whatever fixed failure the use case gives', async () => {
    useCases.finishAddPasskey.mockResolvedValue({ ok: false, failure: 'sign-in-again' })
    expect(await addPasskey({ answer })).toEqual({ ok: false, failure: 'sign-in-again' })
  })
})
