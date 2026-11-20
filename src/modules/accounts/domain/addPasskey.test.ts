import { describe, expect, it } from 'vitest'

import {
  addPasskeySchema,
  registrationAnswerSchema,
  toChallengeId,
  type RegistrationAnswer,
} from './addPasskey'

const answer: RegistrationAnswer = {
  id: 'Y3JlZGVudGlhbC1pZA',
  rawId: 'Y3JlZGVudGlhbC1pZA',
  type: 'public-key',
  authenticatorAttachment: 'platform',
  clientExtensionResults: {},
  response: {
    clientDataJSON: 'eyJ0eXBlIjoid2ViYXV0aG4uY3JlYXRlIn0',
    attestationObject: 'o2NmbXRkbm9uZQ',
    transports: ['internal', 'hybrid'],
  },
}

describe('registrationAnswerSchema', () => {
  it('accepts what the browser sends', () => {
    expect(registrationAnswerSchema.parse(answer)).toEqual(answer)
  })

  it('keeps only the fields the library reads, so a field a browser adds later is not a refusal', () => {
    const parsed = registrationAnswerSchema.parse({
      ...answer,
      somethingNew: 1,
      response: { ...answer.response, alsoNew: 'x', publicKeyAlgorithm: -7 },
    })
    expect(parsed).not.toHaveProperty('somethingNew')
    expect(parsed.response).not.toHaveProperty('alsoNew')
    expect(parsed.response.publicKeyAlgorithm).toBe(-7)
  })

  it('takes a null attachment as none', () => {
    const parsed = registrationAnswerSchema.parse({ ...answer, authenticatorAttachment: null })
    expect(parsed.authenticatorAttachment).toBeUndefined()
  })

  it.each([
    ['not an object', 'text'],
    ['no id', { ...answer, id: undefined }],
    ['an empty id', { ...answer, id: '' }],
    ['a huge id', { ...answer, id: 'a'.repeat(2000) }],
    ['another type', { ...answer, type: 'password' }],
    ['no attestation', { ...answer, response: { clientDataJSON: 'x' } }],
    [
      'a huge attestation',
      { ...answer, response: { ...answer.response, attestationObject: 'a'.repeat(20_000) } },
    ],
    [
      'a transport that isn’t text',
      { ...answer, response: { ...answer.response, transports: [1] } },
    ],
    ['an unknown attachment', { ...answer, authenticatorAttachment: 'usb' }],
  ])('refuses %s', (_name, input) => {
    expect(registrationAnswerSchema.safeParse(input).success).toBe(false)
  })
})

describe('addPasskeySchema', () => {
  it('takes the answer and an optional label, and nothing else', () => {
    expect(addPasskeySchema.safeParse({ answer }).success).toBe(true)
    expect(addPasskeySchema.safeParse({ answer, label: 'My phone' }).success).toBe(true)
    expect(addPasskeySchema.safeParse({ answer, accountId: 7 }).success).toBe(false)
    expect(addPasskeySchema.safeParse({ answer, label: 'x'.repeat(500) }).success).toBe(false)
    expect(addPasskeySchema.safeParse({ label: 'My phone' }).success).toBe(false)
  })
})

describe('toChallengeId', () => {
  it('reads the row identifier a challenge cookie carries', () => {
    expect(toChallengeId({ cid: 12 })).toBe(12)
  })

  it.each([null, {}, { cid: '12' }, { cid: 0 }, { cid: -1 }, { cid: 1.5 }, { cid: 2 ** 60 }])(
    'refuses %j',
    (data) => {
      expect(toChallengeId(data)).toBeNull()
    },
  )
})
