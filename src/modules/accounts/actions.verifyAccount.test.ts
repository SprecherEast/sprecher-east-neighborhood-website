import { createHash } from 'node:crypto'

import type * as PayloadModule from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  edges,
  nextAuthWithEdges,
  nextHeadersWithEdges,
  payloadWithEdges,
  resetEdges,
} from './testing/actionEdges'

vi.mock('payload', async (importActual) => payloadWithEdges(await importActual()))
vi.mock('@payloadcms/next/auth', () => nextAuthWithEdges())
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('next/headers', () => nextHeadersWithEdges())

import { verifyAccount } from './actions'

// Payload's real errors, as its operations throw them
const { APIError } = await vi.importActual<typeof PayloadModule>('payload')

beforeEach(resetEdges)

const token = '0123456789abcdef0123456789abcdef01234567'
const password = 'correct-horse'
/** The account that holds the link's token, as Payload's find returns it */
const holding = (verificationSetsPassword: boolean) => ({
  docs: [{ id: 9, _verified: false, verificationSetsPassword }],
})

describe('verifyAccount', () => {
  it('verifies the account with Payload’s verifyEmail and the link’s token', async () => {
    edges.find.mockResolvedValue(holding(false))
    edges.verifyEmail.mockResolvedValue(true)
    expect(await verifyAccount({ token })).toEqual({ ok: true })
    expect(edges.find).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        collection: 'users',
        where: { _verificationToken: { equals: token } },
        overrideAccess: true,
        showHiddenFields: true,
      }),
    )
    expect(edges.verifyEmail).toHaveBeenCalledExactlyOnceWith({ collection: 'users', token })
    expect(edges.update).not.toHaveBeenCalled()
    expect(edges.signInHelper).not.toHaveBeenCalled()
  })

  it('reads an unknown or used token as a dead link', async () => {
    edges.find.mockResolvedValue({ docs: [] })
    edges.verifyEmail.mockRejectedValue(new APIError('Verification token is invalid.', 403))
    expect(await verifyAccount({ token })).toEqual({ ok: false, failure: 'invalid-link' })
    expect(console.error).not.toHaveBeenCalled()
  })

  it('logs only the error’s name when it fails on our side', async () => {
    edges.find.mockResolvedValue(holding(false))
    edges.verifyEmail.mockRejectedValue(new APIError('Database down', 500))
    expect(await verifyAccount({ token })).toEqual({ ok: false, failure: 'server-error' })
    expect(console.error).toHaveBeenCalledExactlyOnceWith(
      'Account verification failed on the server (APIError)',
    )
  })

  it('reads input that doesn’t parse as a dead link, without asking Payload', async () => {
    for (const values of [
      null,
      { token: '' },
      { token, email: 'a@example.com' },
      { token, newPassword: password },
      { token, newPassword: password, confirmPassword: 'different' },
      { token, newPassword: 'short', confirmPassword: 'short' },
    ]) {
      expect(await verifyAccount(values)).toEqual({ ok: false, failure: 'invalid-link' })
    }
    expect(edges.find).not.toHaveBeenCalled()
    expect(edges.verifyEmail).not.toHaveBeenCalled()
  })
})

// A link resent after a second sign-up opens the account only with a password chosen here (#289)
describe('verifyAccount: a resent link', () => {
  it('asks for a password first, and leaves the link unused', async () => {
    edges.find.mockResolvedValue(holding(true))
    expect(await verifyAccount({ token })).toEqual({ ok: false, failure: 'needs-password' })
    expect(edges.update).not.toHaveBeenCalled()
    expect(edges.verifyEmail).not.toHaveBeenCalled()
  })

  it('sets the chosen password, then verifies the email', async () => {
    edges.find.mockResolvedValue(holding(true))
    edges.update.mockResolvedValue({ id: 9 })
    edges.verifyEmail.mockResolvedValue(true)
    expect(
      await verifyAccount({ token, newPassword: password, confirmPassword: password }),
    ).toEqual({ ok: true })
    expect(edges.update).toHaveBeenCalledExactlyOnceWith({
      collection: 'users',
      id: 9,
      data: { password, verificationSetsPassword: false },
      depth: 0,
      overrideAccess: true,
    })
    expect(edges.verifyEmail).toHaveBeenCalledExactlyOnceWith({ collection: 'users', token })
    expect(edges.update.mock.invocationCallOrder[0]).toBeLessThan(
      edges.verifyEmail.mock.invocationCallOrder[0] ?? 0,
    )
  })

  it('ignores a password sent with a first link: that account keeps its own', async () => {
    edges.find.mockResolvedValue(holding(false))
    edges.verifyEmail.mockResolvedValue(true)
    expect(
      await verifyAccount({ token, newPassword: password, confirmPassword: password }),
    ).toEqual({ ok: true })
    expect(edges.update).not.toHaveBeenCalled()
  })
})

// A link opened again after it verified its account says so (#391)
describe('verifyAccount: a used link', () => {
  const hash = createHash('sha256').update(token).digest('hex')

  it('keeps the hash of the link that verified the account', async () => {
    edges.find.mockResolvedValue(holding(false))
    edges.verifyEmail.mockResolvedValue(true)
    expect(await verifyAccount({ token })).toEqual({ ok: true })
    expect(edges.dbUpdateOne).toHaveBeenCalledExactlyOnceWith({
      collection: 'users',
      id: 9,
      data: { verifiedTokenHash: hash },
      returning: false,
    })
    expect(edges.dbUpdateOne.mock.invocationCallOrder[0]).toBeGreaterThan(
      edges.verifyEmail.mock.invocationCallOrder[0] ?? 0,
    )
  })

  it('answers already-verified for that link, without asking Payload to verify', async () => {
    edges.find.mockResolvedValueOnce({ docs: [] }).mockResolvedValueOnce({ docs: [{ id: 9 }] })
    expect(await verifyAccount({ token })).toEqual({ ok: false, failure: 'already-verified' })
    expect(edges.find).toHaveBeenLastCalledWith(
      expect.objectContaining({
        collection: 'users',
        where: { verifiedTokenHash: { equals: hash } },
        overrideAccess: true,
      }),
    )
    expect(edges.verifyEmail).not.toHaveBeenCalled()
  })

  it('still verifies when keeping the hash fails, and logs only the error’s name', async () => {
    edges.find.mockResolvedValue(holding(false))
    edges.verifyEmail.mockResolvedValue(true)
    edges.dbUpdateOne.mockRejectedValue(new APIError('Database down', 500))
    expect(await verifyAccount({ token })).toEqual({ ok: true })
    expect(console.error).toHaveBeenCalledExactlyOnceWith(
      'Recording a used verification link failed on the server (APIError)',
    )
  })
})
