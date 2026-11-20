import { beforeEach, describe, expect, it, vi } from 'vitest'

// The use cases are replaced: this tests what the actions do with their input and the request
const useCases = vi.hoisted(() => ({ startPasskeySignIn: vi.fn(), finishPasskeySignIn: vi.fn() }))
vi.mock('./use-cases/signInWithPasskey', () => useCases)
const request = vi.hoisted(() => ({ headers: new Headers() }))
vi.mock('next/headers', () => ({ headers: async () => request.headers }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', async (importActual) => ({ ...(await importActual<object>()) }))
vi.mock('@payloadcms/next/auth', () => ({ login: vi.fn() }))

import { getPasskeyLoginOptions, logInWithPasskey } from './actions'

const answer = {
  id: 'abc',
  rawId: 'abc',
  type: 'public-key',
  clientExtensionResults: {},
  response: {
    clientDataJSON: 'eyJ9',
    authenticatorData: 'AAAA',
    signature: 'BBBB',
    userHandle: 'aGk',
  },
}

beforeEach(() => {
  useCases.startPasskeySignIn
    .mockReset()
    .mockResolvedValue({ ok: true, options: { challenge: 'c' } })
  useCases.finishPasskeySignIn.mockReset().mockResolvedValue({ ok: true })
  request.headers = new Headers()
})

describe('getPasskeyLoginOptions', () => {
  it('takes no input and passes only the connection’s address on', async () => {
    request.headers = new Headers({ 'x-forwarded-for': '203.0.113.9' })
    expect(await getPasskeyLoginOptions()).toEqual({ ok: true, options: { challenge: 'c' } })
    expect(useCases.startPasskeySignIn).toHaveBeenCalledExactlyOnceWith('203.0.113.9')
  })

  it('passes no address when the request names none', async () => {
    await getPasskeyLoginOptions()
    expect(useCases.startPasskeySignIn).toHaveBeenCalledExactlyOnceWith(null)
  })
})

describe('logInWithPasskey', () => {
  it('parses the input again and passes on only the answer and "Keep me signed in"', async () => {
    const result = await logInWithPasskey({ answer: { ...answer, extra: 1 }, rememberMe: true })
    expect(result).toEqual({ ok: true })
    expect(useCases.finishPasskeySignIn).toHaveBeenCalledExactlyOnceWith({
      answer: { ...answer, authenticatorAttachment: undefined },
      rememberMe: true,
    })
  })

  it('leaves "Keep me signed in" off when the caller says nothing, as for a password', async () => {
    await logInWithPasskey({ answer })
    expect(useCases.finishPasskeySignIn.mock.calls[0]?.[0].rememberMe).toBe(false)
  })

  it('reads a null user handle or attachment as none', async () => {
    await logInWithPasskey({
      answer: {
        ...answer,
        authenticatorAttachment: null,
        response: { ...answer.response, userHandle: null },
      },
    })
    const sent = useCases.finishPasskeySignIn.mock.calls[0]?.[0].answer
    expect(sent.authenticatorAttachment).toBeUndefined()
    expect(sent.response.userHandle).toBeUndefined()
  })

  it.each([
    ['nothing', undefined],
    ['text', 'hello'],
    ['no answer', { rememberMe: true }],
    ['an answer of the wrong type', { answer: { ...answer, type: 'password' } }],
    [
      'an answer with no signature',
      { answer: { ...answer, response: { ...answer.response, signature: '' } } },
    ],
    ['an account named by the caller', { answer, accountId: 8 }],
    ['an email', { answer, email: 'ada@example.com' }],
    ['"Keep me signed in" as text', { answer, rememberMe: 'yes' }],
  ])('refuses %s with the one failure, calling nothing', async (_name, input) => {
    expect(await logInWithPasskey(input)).toEqual({ ok: false, failure: 'failed' })
    expect(useCases.finishPasskeySignIn).not.toHaveBeenCalled()
  })

  it('answers with whatever fixed failure the use case gives', async () => {
    useCases.finishPasskeySignIn.mockResolvedValue({ ok: false, failure: 'failed' })
    expect(await logInWithPasskey({ answer })).toEqual({ ok: false, failure: 'failed' })
  })
})
