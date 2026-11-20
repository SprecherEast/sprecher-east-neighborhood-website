import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PasskeyCreationOptions } from '../domain/addPasskey'

const library = vi.hoisted(() => ({
  browserSupportsPasskeys: vi.fn(),
  startRegistration: vi.fn(),
}))
vi.mock('@simplewebauthn/browser', () => library)

import { createPasskey, passkeysSupported } from './passkeyBrowser'

const options = { challenge: 'c' } as PasskeyCreationOptions

beforeEach(() => {
  library.browserSupportsPasskeys.mockReset()
  library.startRegistration.mockReset()
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
