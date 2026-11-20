import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PasskeyCreationOptions } from '../domain/addPasskey'
import type { PasskeyRequestOptions } from '../domain/signInWithPasskey'

const library = vi.hoisted(() => ({
  browserSupportsPasskeys: vi.fn(),
  browserSupportsWebAuthnAutofill: vi.fn(),
  startRegistration: vi.fn(),
  startAuthentication: vi.fn(),
}))
vi.mock('@simplewebauthn/browser', () => library)

import {
  createPasskey,
  getPasskey,
  passkeyAutofillSupported,
  passkeysSupported,
} from './passkeyBrowser'

const options = { challenge: 'c' } as PasskeyCreationOptions

beforeEach(() => {
  for (const fn of Object.values(library)) fn.mockReset()
})

/** An error as the library throws it: the browser's error name, a code of its own. */
const libraryError = (name: string, code?: string) =>
  Object.assign(new Error('a message with details'), { name, code })

describe('passkeysSupported', () => {
  it('follows the browser, and says no when the browser can’t tell', async () => {
    library.browserSupportsPasskeys.mockResolvedValue(true)
    expect(await passkeysSupported()).toBe(true)
    library.browserSupportsPasskeys.mockResolvedValue(false)
    expect(await passkeysSupported()).toBe(false)
    library.browserSupportsPasskeys.mockRejectedValue(new Error('x'))
    expect(await passkeysSupported()).toBe(false)
  })
})

describe('createPasskey', () => {
  it('hands the options to the library and gives its answer as it is', async () => {
    library.startRegistration.mockResolvedValue({ id: 'abc' })
    expect(await createPasskey(options)).toEqual({ ok: true, answer: { id: 'abc' } })
    expect(library.startRegistration).toHaveBeenCalledExactlyOnceWith({ optionsJSON: options })
  })

  it.each(['NotAllowedError', 'AbortError'])('reads %s as a closed prompt', async (name) => {
    library.startRegistration.mockRejectedValue(
      libraryError(name, 'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY'),
    )
    expect(await createPasskey(options)).toEqual({ ok: false, reason: 'cancelled' })
  })

  it('reads a device that already holds the passkey as such', async () => {
    library.startRegistration.mockRejectedValue(
      libraryError('InvalidStateError', 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED'),
    )
    expect(await createPasskey(options)).toEqual({ ok: false, reason: 'already-here' })
  })

  it.each([
    ['another error', libraryError('SecurityError', 'ERROR_INVALID_DOMAIN')],
    ['a plain error', new Error('x')],
    ['a thrown string', 'boom'],
    ['null', null],
  ])('gives one failure for %s, with none of its text', async (_name, thrown) => {
    library.startRegistration.mockRejectedValue(thrown)
    expect(await createPasskey(options)).toEqual({ ok: false, reason: 'failed' })
  })
})

describe('passkeyAutofillSupported', () => {
  it('follows the browser, and says no when the browser can’t tell', async () => {
    library.browserSupportsWebAuthnAutofill.mockResolvedValue(true)
    expect(await passkeyAutofillSupported()).toBe(true)
    library.browserSupportsWebAuthnAutofill.mockResolvedValue(false)
    expect(await passkeyAutofillSupported()).toBe(false)
    library.browserSupportsWebAuthnAutofill.mockRejectedValue(new Error('x'))
    expect(await passkeyAutofillSupported()).toBe(false)
  })
})

describe('getPasskey', () => {
  const requestOptions = { challenge: 'c' } as PasskeyRequestOptions

  it('hands the options to the library as a prompt, and gives its answer as it is', async () => {
    library.startAuthentication.mockResolvedValue({ id: 'abc' })
    expect(await getPasskey(requestOptions)).toEqual({ ok: true, answer: { id: 'abc' } })
    expect(library.startAuthentication).toHaveBeenCalledExactlyOnceWith({
      optionsJSON: requestOptions,
      useBrowserAutofill: false,
    })
  })

  it('asks the library to wait in the email field’s autofill instead, when told to', async () => {
    library.startAuthentication.mockResolvedValue({ id: 'abc' })
    await getPasskey(requestOptions, { autofill: true })
    expect(library.startAuthentication).toHaveBeenCalledExactlyOnceWith({
      optionsJSON: requestOptions,
      useBrowserAutofill: true,
    })
  })

  it.each(['NotAllowedError', 'AbortError'])(
    'reads %s as a closed prompt, or one a newer prompt replaced',
    async (name) => {
      library.startAuthentication.mockRejectedValue(libraryError(name, 'ERROR_CEREMONY_ABORTED'))
      expect(await getPasskey(requestOptions)).toEqual({ ok: false, reason: 'cancelled' })
    },
  )

  it.each([
    ['another error', libraryError('SecurityError', 'ERROR_INVALID_RP_ID')],
    ['a plain error', new Error('x')],
    ['a thrown string', 'boom'],
    ['null', null],
  ])('gives one failure for %s, with none of its text', async (_name, thrown) => {
    library.startAuthentication.mockRejectedValue(thrown)
    expect(await getPasskey(requestOptions)).toEqual({ ok: false, reason: 'failed' })
  })
})
