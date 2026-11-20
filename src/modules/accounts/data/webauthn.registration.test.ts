import { beforeAll, describe, expect, it } from 'vitest'

import { softwareRegistration } from '../testing/softwareAuthenticator'
import { makeRegistrationOptions, verifyNewPasskey } from './webauthn'

// The real library, with a software authenticator's answers (`testing/softwareAuthenticator.ts`):
// a real device can't be driven here, so this is the library's own format, made by hand. It shows
// the adapter's settings reach the options, and that a good answer verifies while each wrong one
// (another challenge, origin, relying party, type, framed, no screen lock) gives nothing.

const relyingParty = { id: 'sprecher-east.example', origin: 'https://sprecher-east.example' }
const userHandle = Buffer.alloc(32, 7).toString('base64url')

let options: Awaited<ReturnType<typeof makeRegistrationOptions>>['options']
let challenge: string

beforeAll(async () => {
  ;({ options, challenge } = await makeRegistrationOptions({
    relyingParty,
    userName: 'Sprecher East passkey',
    userHandle,
    existing: [{ credentialId: 'AAAA', transports: ['internal'] }],
  }))
})

const answer = (over: Partial<Parameters<typeof softwareRegistration>[0]> = {}) =>
  softwareRegistration({ options, origin: relyingParty.origin, rpID: relyingParty.id, ...over })

const verify = (a = answer()) => verifyNewPasskey({ answer: a, challenge, relyingParty })

describe('the options the real library makes', () => {
  it('carry the adapter’s settings, the handle’s own text, and no email', () => {
    expect(options).toMatchObject({
      rp: { name: 'Sprecher East', id: 'sprecher-east.example' },
      user: { id: userHandle, name: 'Sprecher East passkey' },
      attestation: 'none',
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
      excludeCredentials: [{ id: 'AAAA', type: 'public-key', transports: ['internal'] }],
    })
    expect(challenge).toBe(options.challenge)
    expect(Buffer.from(challenge, 'base64url').length).toBeGreaterThanOrEqual(32)
  })
})

describe('a good answer', () => {
  it('verifies and gives the passkey to store', async () => {
    const made = answer({ multiDevice: true, backedUp: true })
    const passkey = await verify(made)
    expect(passkey).toMatchObject({
      credentialId: made.id,
      counter: 0,
      transports: ['internal', 'hybrid'],
      deviceType: 'multiDevice',
      backedUp: true,
    })
    expect(passkey?.publicKey.length).toBeGreaterThan(40)
  })

  it('reads a single-device passkey as one', async () => {
    expect(await verify(answer({ multiDevice: false, backedUp: false }))).toMatchObject({
      deviceType: 'singleDevice',
      backedUp: false,
    })
  })
})

describe('a wrong answer gives nothing', () => {
  it.each([
    ['another challenge', { challenge: Buffer.from('another').toString('base64url') }],
    ['another origin', { origin: 'https://other.example' }],
    ['a subdomain of the site', { origin: 'https://preview.sprecher-east.example' }],
    ['another relying party', { rpID: 'other.example' }],
    ['the sign-in type', { type: 'webauthn.get' }],
    ['a frame on another site', { crossOrigin: true }],
    ['no screen lock', { userVerified: false }],
    ['no user presence', { userPresent: false }],
  ])('%s', async (_name, over) => {
    expect(await verify(answer(over))).toBeNull()
  })

  it('a damaged attestation', async () => {
    const good = answer()
    const damaged = { ...good, response: { ...good.response, attestationObject: 'AAAA' } }
    expect(await verify(damaged)).toBeNull()
  })
})
