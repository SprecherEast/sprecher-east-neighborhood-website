import { beforeAll, describe, expect, it } from 'vitest'

import { newSoftwareCredential, softwareAssertion } from '../testing/softwareAuthenticator'
import { makeAuthenticationOptions, verifyPasskeyAnswer } from './webauthn'

// The real library, with a software authenticator's signed answers
// (`testing/softwareAuthenticator.ts`): a real device can't be driven here. It shows the adapter's
// settings reach the sign-in options, and that a good answer verifies while each wrong one
// (another challenge, origin, relying party, type, key, framed, no screen lock, a counter that
// doesn't go up) gives nothing.

const relyingParty = { id: 'sprecher-east.example', origin: 'https://sprecher-east.example' }
const credential = newSoftwareCredential()
const stored = (counter = 0) => ({
  credentialId: credential.credentialId,
  publicKey: credential.publicKey,
  counter,
  transports: ['internal'],
})

let options: Awaited<ReturnType<typeof makeAuthenticationOptions>>['options']
let challenge: string

beforeAll(async () => {
  ;({ options, challenge } = await makeAuthenticationOptions({ relyingParty }))
})

const answer = (over: Partial<Parameters<typeof softwareAssertion>[0]> = {}) =>
  softwareAssertion({
    credential,
    options,
    origin: relyingParty.origin,
    rpID: relyingParty.id,
    ...over,
  })

const verify = (a = answer(), over: { challenge?: string; counter?: number } = {}) =>
  verifyPasskeyAnswer({
    answer: a,
    challenge: over.challenge ?? challenge,
    relyingParty,
    credential: stored(over.counter),
  })

describe('the sign-in options the real library makes', () => {
  it('carry the relying party, require the screen lock, and name no account or credential', () => {
    expect(options).toMatchObject({ rpId: 'sprecher-east.example', userVerification: 'required' })
    expect(options.allowCredentials ?? []).toEqual([])
    expect(challenge).toBe(options.challenge)
    expect(Buffer.from(challenge, 'base64url').length).toBeGreaterThanOrEqual(32)
  })

  it('make a new challenge every time', async () => {
    expect((await makeAuthenticationOptions({ relyingParty })).challenge).not.toBe(challenge)
  })
})

describe('a good answer', () => {
  it('verifies and gives the credential and the counter to keep', async () => {
    expect(await verify(answer({ counter: 5 }), { counter: 4 })).toEqual({
      credentialId: credential.credentialId,
      newCounter: 5,
    })
  })

  it('lets a synced passkey that always reports zero through, against zero', async () => {
    expect(await verify(answer({ counter: 0 }))).toEqual({
      credentialId: credential.credentialId,
      newCounter: 0,
    })
  })
})

describe('a wrong answer gives nothing', () => {
  it.each([
    ['another challenge', { challenge: Buffer.from('another').toString('base64url') }],
    ['another origin', { origin: 'https://other.example' }],
    ['a subdomain of the site', { origin: 'https://preview.sprecher-east.example' }],
    ['another relying party', { rpID: 'other.example' }],
    ['the registration type', { type: 'webauthn.create' }],
    ['a frame on another site', { crossOrigin: true }],
    ['no screen lock', { userVerified: false }],
    ['no user presence', { userPresent: false }],
    ['a signature made with another key', { signWith: newSoftwareCredential().privateKey }],
  ])('%s', async (_name, over) => {
    expect(await verify(answer(over))).toBeNull()
  })

  it('a counter that did not go up', async () => {
    expect(await verify(answer({ counter: 4 }), { counter: 4 })).toBeNull()
    expect(await verify(answer({ counter: 3 }), { counter: 4 })).toBeNull()
  })

  it('a credential that is not the stored one', async () => {
    const other = newSoftwareCredential()
    expect(
      await verifyPasskeyAnswer({
        answer: answer(),
        challenge,
        relyingParty,
        credential: { ...stored(), credentialId: other.credentialId },
      }),
    ).toBeNull()
  })

  it('a damaged signature', async () => {
    const good = answer()
    const damaged = { ...good, response: { ...good.response, signature: 'AAAA' } }
    expect(await verify(damaged)).toBeNull()
  })
})
