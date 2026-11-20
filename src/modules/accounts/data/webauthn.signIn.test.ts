import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AuthenticationAnswer } from '../domain/signInWithPasskey'

// The adapter's contract with the library for signing in (decision 0021): what it asks of it, and
// that nothing but `verified === true` passes. The library is replaced here;
// `webauthn.authentication.test.ts` runs the real one.
const library = vi.hoisted(() => ({
  generateAuthenticationOptions: vi.fn(),
  verifyAuthenticationResponse: vi.fn(),
}))
vi.mock('@simplewebauthn/server', () => library)

import { makeAuthenticationOptions, verifyPasskeyAnswer } from './webauthn'

const relyingParty = { id: 'sprecher-east.example', origin: 'https://sprecher-east.example' }
const credential = { credentialId: 'abc', publicKey: 'AQID', counter: 4, transports: ['internal'] }

const clientData = (extra: object = {}) =>
  Buffer.from(
    JSON.stringify({ type: 'webauthn.get', challenge: 'c', origin: relyingParty.origin, ...extra }),
  ).toString('base64url')

const answerWith = (clientDataJSON = clientData()): AuthenticationAnswer => ({
  id: 'abc',
  rawId: 'abc',
  type: 'public-key',
  clientExtensionResults: {},
  response: { clientDataJSON, authenticatorData: 'AAAA', signature: 'BBBB' },
})

const verifiedResult = { verified: true, authenticationInfo: { credentialID: 'abc', newCounter: 5 } }

beforeEach(() => {
  library.generateAuthenticationOptions.mockReset()
  library.verifyAuthenticationResponse.mockReset()
})

describe('makeAuthenticationOptions', () => {
  beforeEach(() => {
    library.generateAuthenticationOptions.mockResolvedValue({ challenge: 'made-by-library' })
  })

  it('asks for the screen lock explicitly and lists no credential, so the device offers its own', async () => {
    await makeAuthenticationOptions({ relyingParty })
    const asked = library.generateAuthenticationOptions.mock.calls[0]?.[0]
    expect(asked).toMatchObject({ rpID: 'sprecher-east.example', userVerification: 'required' })
    expect(asked).not.toHaveProperty('allowCredentials')
    expect(asked).not.toHaveProperty('challenge')
  })

  it('gives back the options and the challenge the library made', async () => {
    expect(await makeAuthenticationOptions({ relyingParty })).toEqual({
      options: { challenge: 'made-by-library' },
      challenge: 'made-by-library',
    })
  })
})

describe('verifyPasskeyAnswer', () => {
  const verify = (answer = answerWith()) =>
    verifyPasskeyAnswer({ answer, challenge: 'c', relyingParty, credential })

  it('checks against one origin, the relying party ID, the challenge and the screen lock', async () => {
    library.verifyAuthenticationResponse.mockResolvedValue(verifiedResult)
    await verify()
    expect(library.verifyAuthenticationResponse).toHaveBeenCalledExactlyOnceWith({
      response: answerWith(),
      expectedChallenge: 'c',
      expectedOrigin: 'https://sprecher-east.example',
      expectedRPID: 'sprecher-east.example',
      expectedType: 'webauthn.get',
      requireUserVerification: true,
      credential: {
        id: 'abc',
        publicKey: new Uint8Array([1, 2, 3]),
        counter: 4,
        transports: ['internal'],
      },
    })
  })

  it('gives the credential and the counter to keep', async () => {
    library.verifyAuthenticationResponse.mockResolvedValue(verifiedResult)
    expect(await verify()).toEqual({ credentialId: 'abc', newCounter: 5 })
  })

  it.each([
    ['not verified', { verified: false }],
    ['verified as the text true', { verified: 'true', authenticationInfo: verifiedResult.authenticationInfo }],
    ['verified as 1', { verified: 1, authenticationInfo: verifiedResult.authenticationInfo }],
    ['no answer at all', undefined],
    ['another credential', { verified: true, authenticationInfo: { credentialID: 'zzz', newCounter: 5 } }],
    ['a counter that is not a number', { verified: true, authenticationInfo: { credentialID: 'abc', newCounter: '5' } }],
  ])('gives nothing when the library says %s', async (_name, result) => {
    library.verifyAuthenticationResponse.mockResolvedValue(result)
    expect(await verify()).toBeNull()
  })

  it.each([
    ['an error', new Error('Unexpected authentication response challenge "c", expected "d"')],
    ['a type error', new TypeError('x')],
    ['a thrown string', 'boom'],
  ])('gives the same nothing when the library throws %s', async (_name, thrown) => {
    library.verifyAuthenticationResponse.mockRejectedValue(thrown)
    expect(await verify()).toBeNull()
  })

  it.each([
    ['true', { crossOrigin: true }],
    ['the text true', { crossOrigin: 'true' }],
    ['1', { crossOrigin: 1 }],
    ['null', { crossOrigin: null }],
  ])('refuses an answer made in a frame (crossOrigin %s) before asking the library', async (_n, extra) => {
    library.verifyAuthenticationResponse.mockResolvedValue(verifiedResult)
    expect(await verify(answerWith(clientData(extra)))).toBeNull()
    expect(library.verifyAuthenticationResponse).not.toHaveBeenCalled()
  })

  it.each([
    ['id', { id: 'zzz' }],
    ['rawId', { rawId: 'zzz' }],
  ])('refuses an answer whose %s is not the stored credential’s, before asking the library', async (_n, over) => {
    library.verifyAuthenticationResponse.mockResolvedValue(verifiedResult)
    expect(await verify({ ...answerWith(), ...over })).toBeNull()
    expect(library.verifyAuthenticationResponse).not.toHaveBeenCalled()
  })

  it('lets an answer with crossOrigin false, or none, through', async () => {
    library.verifyAuthenticationResponse.mockResolvedValue(verifiedResult)
    expect(await verify(answerWith(clientData({ crossOrigin: false })))).not.toBeNull()
    expect(await verify(answerWith(clientData()))).not.toBeNull()
  })

  it.each([
    ['not base64url JSON', 'not json at all!'],
    ['JSON that isn’t an object', Buffer.from('7').toString('base64url')],
    ['null', Buffer.from('null').toString('base64url')],
  ])('refuses client data that is %s', async (_name, clientDataJSON) => {
    library.verifyAuthenticationResponse.mockResolvedValue(verifiedResult)
    expect(await verify(answerWith(clientDataJSON))).toBeNull()
    expect(library.verifyAuthenticationResponse).not.toHaveBeenCalled()
  })
})
