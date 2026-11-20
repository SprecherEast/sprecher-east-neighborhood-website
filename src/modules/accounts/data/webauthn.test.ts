import { randomBytes } from 'node:crypto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { RegistrationAnswer } from '../domain/addPasskey'

// The adapter's contract with the library (decision 0021): what it asks of it, and that nothing
// but `verified === true` passes. The library is replaced here; `webauthn.registration.test.ts`
// runs the real one.
const library = vi.hoisted(() => ({
  generateRegistrationOptions: vi.fn(),
  verifyRegistrationResponse: vi.fn(),
}))
vi.mock('@simplewebauthn/server', () => library)

import { makeRegistrationOptions, verifyNewPasskey } from './webauthn'

const relyingParty = { id: 'sprecher-east.example', origin: 'https://sprecher-east.example' }
const handleBytes = randomBytes(32)
const userHandle = handleBytes.toString('base64url')

const clientData = (extra: object = {}) =>
  Buffer.from(
    JSON.stringify({ type: 'webauthn.create', challenge: 'c', origin: relyingParty.origin, ...extra }),
  ).toString('base64url')

const answerWith = (clientDataJSON = clientData()): RegistrationAnswer => ({
  id: 'abc',
  rawId: 'abc',
  type: 'public-key',
  clientExtensionResults: {},
  response: { clientDataJSON, attestationObject: 'o2Nm', transports: ['usb'] },
})

const verifiedResult = {
  verified: true,
  registrationInfo: {
    credential: { id: 'abc', publicKey: new Uint8Array([1, 2, 3]), counter: 0, transports: ['internal'] },
    credentialDeviceType: 'multiDevice',
    credentialBackedUp: true,
  },
}

beforeEach(() => {
  library.generateRegistrationOptions.mockReset()
  library.verifyRegistrationResponse.mockReset()
})

describe('makeRegistrationOptions', () => {
  beforeEach(() => {
    library.generateRegistrationOptions.mockResolvedValue({ challenge: 'made-by-library' })
  })

  const make = (existing = [{ credentialId: 'old', transports: ['usb'] }]) =>
    makeRegistrationOptions({ relyingParty, userName: 'Sprecher East passkey', userHandle, existing })

  it('asks for a discoverable credential and the screen lock explicitly, with no attestation', async () => {
    await make()
    const asked = library.generateRegistrationOptions.mock.calls[0]?.[0]
    expect(asked).toMatchObject({
      rpName: 'Sprecher East',
      rpID: 'sprecher-east.example',
      userName: 'Sprecher East passkey',
      attestationType: 'none',
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    })
  })

  it('leaves the challenge to the library and gives back the one it made', async () => {
    const made = await make()
    expect(library.generateRegistrationOptions.mock.calls[0]?.[0]).not.toHaveProperty('challenge')
    expect(made).toEqual({
      options: { challenge: 'made-by-library' },
      challenge: 'made-by-library',
    })
  })

  it('hands the stored handle over as its bytes, not as text', async () => {
    await make()
    const { userID } = library.generateRegistrationOptions.mock.calls[0]?.[0]
    expect(userID).toBeInstanceOf(Uint8Array)
    expect(Buffer.from(userID)).toEqual(handleBytes)
    expect(Buffer.from(userID).toString('base64url')).toBe(userHandle)
  })

  it('excludes the credentials the account already has', async () => {
    await make([{ credentialId: 'old', transports: ['usb'] }])
    expect(library.generateRegistrationOptions.mock.calls[0]?.[0].excludeCredentials).toEqual([
      { id: 'old', transports: ['usb'] },
    ])
  })

  it.each(['', 'short', Buffer.alloc(33).toString('base64url')])(
    'refuses a stored handle that isn’t 32 bytes (%j)',
    async (bad) => {
      await expect(
        makeRegistrationOptions({ relyingParty, userName: 'x', userHandle: bad, existing: [] }),
      ).rejects.toThrow()
      expect(library.generateRegistrationOptions).not.toHaveBeenCalled()
    },
  )
})

describe('verifyNewPasskey', () => {
  const verify = (answer = answerWith()) =>
    verifyNewPasskey({ answer, challenge: 'c', relyingParty })

  it('checks the answer against one origin, the relying party ID and the screen lock', async () => {
    library.verifyRegistrationResponse.mockResolvedValue(verifiedResult)
    await verify()
    expect(library.verifyRegistrationResponse).toHaveBeenCalledExactlyOnceWith({
      response: answerWith(),
      expectedChallenge: 'c',
      expectedOrigin: 'https://sprecher-east.example',
      expectedRPID: 'sprecher-east.example',
      expectedType: 'webauthn.create',
      requireUserPresence: true,
      requireUserVerification: true,
    })
  })

  it('gives the passkey as the store keeps it', async () => {
    library.verifyRegistrationResponse.mockResolvedValue(verifiedResult)
    expect(await verify()).toEqual({
      credentialId: 'abc',
      publicKey: Buffer.from([1, 2, 3]).toString('base64url'),
      counter: 0,
      transports: ['internal'],
      deviceType: 'multiDevice',
      backedUp: true,
    })
  })

  it('falls back to the transports the browser reported, then to none', async () => {
    const noTransports = {
      ...verifiedResult,
      registrationInfo: {
        ...verifiedResult.registrationInfo,
        credential: { ...verifiedResult.registrationInfo.credential, transports: undefined },
      },
    }
    library.verifyRegistrationResponse.mockResolvedValue(noTransports)
    expect((await verify())?.transports).toEqual(['usb'])
    const bare = answerWith()
    delete bare.response.transports
    expect((await verify(bare))?.transports).toEqual([])
  })

  it.each([
    ['not verified', { verified: false }],
    ['verified as the text true', { verified: 'true', registrationInfo: verifiedResult.registrationInfo }],
    ['verified as 1', { verified: 1, registrationInfo: verifiedResult.registrationInfo }],
    ['no answer at all', undefined],
  ])('gives nothing when the library says %s', async (_name, result) => {
    library.verifyRegistrationResponse.mockResolvedValue(result)
    expect(await verify()).toBeNull()
  })

  it.each([
    ['an error', new Error('Unexpected registration response challenge "c", expected "d"')],
    ['a type error', new TypeError('x')],
    ['a thrown string', 'boom'],
  ])('gives the same nothing when the library throws %s', async (_name, thrown) => {
    library.verifyRegistrationResponse.mockRejectedValue(thrown)
    expect(await verify()).toBeNull()
  })

  it.each([
    ['true', { crossOrigin: true }],
    ['the text true', { crossOrigin: 'true' }],
    ['1', { crossOrigin: 1 }],
    ['null', { crossOrigin: null }],
  ])('refuses an answer made in a frame (crossOrigin %s) before asking the library', async (_n, extra) => {
    library.verifyRegistrationResponse.mockResolvedValue(verifiedResult)
    expect(await verify(answerWith(clientData(extra)))).toBeNull()
    expect(library.verifyRegistrationResponse).not.toHaveBeenCalled()
  })

  it('lets an answer with crossOrigin false, or none, through', async () => {
    library.verifyRegistrationResponse.mockResolvedValue(verifiedResult)
    expect(await verify(answerWith(clientData({ crossOrigin: false })))).not.toBeNull()
    expect(await verify(answerWith(clientData()))).not.toBeNull()
  })

  it.each([
    ['not base64url JSON', 'not json at all!'],
    ['JSON that isn’t an object', Buffer.from('7').toString('base64url')],
    ['null', Buffer.from('null').toString('base64url')],
  ])('refuses client data that is %s', async (_name, clientDataJSON) => {
    library.verifyRegistrationResponse.mockResolvedValue(verifiedResult)
    expect(await verify(answerWith(clientDataJSON))).toBeNull()
    expect(library.verifyRegistrationResponse).not.toHaveBeenCalled()
  })
})
