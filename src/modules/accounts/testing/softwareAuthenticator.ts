import { createHash, generateKeyPairSync, randomBytes, sign, type KeyObject } from 'node:crypto'

import { isoCBOR } from '@simplewebauthn/server/helpers'

import type { PasskeyCreationOptions, RegistrationAnswer } from '../domain/addPasskey'
import type { AuthenticationAnswer, PasskeyRequestOptions } from '../domain/signInWithPasskey'

// A software authenticator for tests (#1314, #1315): it makes the answer a browser sends back for a
// passkey registration (no attestation) and for a sign-in, signed with a key it holds, so the real
// WebAuthn library has something real to check. A real device can't be driven here; this is the
// library's own format, made by hand.

const FLAG_UP = 0x01
const FLAG_UV = 0x04
const FLAG_BE = 0x08
const FLAG_BS = 0x10
const FLAG_AT = 0x40

export type SoftwarePasskeyOptions = {
  options: PasskeyCreationOptions
  origin: string
  rpID: string
  /** Replaces the challenge the browser signs, as an answer to another registration would */
  challenge?: string
  type?: string
  crossOrigin?: unknown
  userVerified?: boolean
  userPresent?: boolean
  /** A multi-device (synced) passkey: the backup-eligible flag */
  multiDevice?: boolean
  backedUp?: boolean
  credentialId?: Buffer
}

const base64url = (bytes: Uint8Array | Buffer) => Buffer.from(bytes).toString('base64url')

/** A fresh P-256 key: the private half, and the public half as a COSE key. */
function newKeyPair(): { privateKey: KeyObject; cose: Map<number, number | Uint8Array> } {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
  const jwk = publicKey.export({ format: 'jwk' })
  const cose = new Map<number, number | Uint8Array>([
    [1, 2], // key type: elliptic curve
    [3, -7], // ES256
    [-1, 1], // P-256
    [-2, Buffer.from(jwk.x ?? '', 'base64url')],
    [-3, Buffer.from(jwk.y ?? '', 'base64url')],
  ])
  return { privateKey, cose }
}

/** The answer a browser would send for these options, made on `origin`. */
export function softwareRegistration({
  options,
  origin,
  rpID,
  challenge = options.challenge,
  type = 'webauthn.create',
  crossOrigin,
  userVerified = true,
  userPresent = true,
  multiDevice = true,
  backedUp = true,
  credentialId = randomBytes(32),
}: SoftwarePasskeyOptions): RegistrationAnswer {
  const { cose } = newKeyPair()
  const flags =
    FLAG_AT |
    (userPresent ? FLAG_UP : 0) |
    (userVerified ? FLAG_UV : 0) |
    (multiDevice ? FLAG_BE : 0) |
    (backedUp ? FLAG_BS : 0)
  const idLength = Buffer.alloc(2)
  idLength.writeUInt16BE(credentialId.length)
  const authData = Buffer.concat([
    createHash('sha256').update(rpID).digest(),
    Buffer.from([flags]),
    Buffer.alloc(4), // a synced passkey reports a counter of zero
    Buffer.alloc(16), // no AAGUID
    idLength,
    credentialId,
    Buffer.from(isoCBOR.encode(cose)),
  ])
  const clientData: Record<string, unknown> = { type, challenge, origin }
  if (crossOrigin !== undefined) clientData.crossOrigin = crossOrigin
  const attestation = new Map<string, unknown>([
    ['fmt', 'none'],
    ['attStmt', new Map()],
    ['authData', authData],
  ])
  return {
    id: base64url(credentialId),
    rawId: base64url(credentialId),
    type: 'public-key',
    authenticatorAttachment: 'platform',
    clientExtensionResults: {},
    response: {
      clientDataJSON: base64url(Buffer.from(JSON.stringify(clientData))),
      attestationObject: base64url(isoCBOR.encode(attestation as never)),
      transports: ['internal', 'hybrid'],
    },
  }
}

/** A passkey held by the software authenticator: how the server stores it, and the key it signs with. */
export type SoftwareCredential = {
  credentialId: string
  /** base64url text of the COSE public key, as `data/passkeys.ts` stores it */
  publicKey: string
  privateKey: KeyObject
}

export function newSoftwareCredential(): SoftwareCredential {
  const { privateKey, cose } = newKeyPair()
  return {
    credentialId: base64url(randomBytes(32)),
    publicKey: base64url(isoCBOR.encode(cose)),
    privateKey,
  }
}

export type SoftwareAssertionOptions = {
  credential: SoftwareCredential
  options: PasskeyRequestOptions
  origin: string
  rpID: string
  /** Replaces the challenge the browser signs, as an answer to another sign-in would */
  challenge?: string
  type?: string
  crossOrigin?: unknown
  userVerified?: boolean
  userPresent?: boolean
  counter?: number
  /** base64url text, as the browser sends it; left out as some authenticators do */
  userHandle?: string
  /** Signs with this key instead of the credential's, as an attacker without the key would */
  signWith?: KeyObject
}

/** The answer a browser would send for these sign-in options, made on `origin`. */
export function softwareAssertion({
  credential,
  options,
  origin,
  rpID,
  challenge = options.challenge,
  type = 'webauthn.get',
  crossOrigin,
  userVerified = true,
  userPresent = true,
  counter = 1,
  userHandle,
  signWith = credential.privateKey,
}: SoftwareAssertionOptions): AuthenticationAnswer {
  const flags = (userPresent ? FLAG_UP : 0) | (userVerified ? FLAG_UV : 0) | FLAG_BE | FLAG_BS
  const count = Buffer.alloc(4)
  count.writeUInt32BE(counter)
  const authData = Buffer.concat([
    createHash('sha256').update(rpID).digest(),
    Buffer.from([flags]),
    count,
  ])
  const clientData: Record<string, unknown> = { type, challenge, origin }
  if (crossOrigin !== undefined) clientData.crossOrigin = crossOrigin
  const clientDataJSON = Buffer.from(JSON.stringify(clientData))
  const signature = sign(
    'sha256',
    Buffer.concat([authData, createHash('sha256').update(clientDataJSON).digest()]),
    signWith,
  )
  return {
    id: credential.credentialId,
    rawId: credential.credentialId,
    type: 'public-key',
    authenticatorAttachment: 'platform',
    clientExtensionResults: {},
    response: {
      clientDataJSON: base64url(clientDataJSON),
      authenticatorData: base64url(authData),
      signature: base64url(signature),
      ...(userHandle === undefined ? {} : { userHandle }),
    },
  }
}
