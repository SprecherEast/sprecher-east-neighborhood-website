import type * as PayloadModule from 'payload'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  edges,
  nextAuthWithEdges,
  nextHeadersWithEdges,
  nextServerWithEdges,
  payloadWithEdges,
  requestHeaders,
  resetEdges,
  robotCheck,
  robotCheckWithEdges,
  runAfterTasks,
} from './testing/actionEdges'

vi.mock('payload', async (importActual) => payloadWithEdges(await importActual()))
vi.mock('@payloadcms/next/auth', () => nextAuthWithEdges())
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('next/headers', () => nextHeadersWithEdges())
vi.mock('next/server', async (importActual) => nextServerWithEdges(await importActual()))
vi.mock('@/platform/turnstile/turnstileVerifier', () => robotCheckWithEdges())

import { signUp } from './actions'

// Payload's real errors, as its operations throw them
const { ValidationError } = await vi.importActual<typeof PayloadModule>('payload')

// Each test starts in a fresh hour, so the limits only count that test's sign-ups
let hour = 0
beforeEach(() => {
  resetEdges()
  hour += 2
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(Date.UTC(2026, 9, 23, hour))
})
afterEach(() => {
  vi.useRealTimers()
})

const password = 'correct-horse'
const input = {
  name: ' Ana ',
  email: ' Ana@Example.com ',
  newPassword: password,
  confirmPassword: password,
}

describe('signUp', () => {
  it('creates a guest with Payload’s create, which emails the verification link', async () => {
    edges.create.mockResolvedValue({ id: 9 })
    expect(await signUp(input)).toEqual({ ok: true })
    expect(edges.create).toHaveBeenCalledExactlyOnceWith({
      collection: 'users',
      data: { name: 'Ana', email: 'ana@example.com', password, role: 'guest' },
      depth: 0,
      overrideAccess: true,
      context: { signUp: true },
    })
    // No session: the account can't sign in until its email is verified
    expect(edges.signInHelper).not.toHaveBeenCalled()
  })

  it('always makes a guest, whatever role or flag the caller sends', async () => {
    for (const extra of [{ role: 'admin' }, { role: 'editor' }, { _verified: true }]) {
      expect(await signUp({ ...input, ...extra })).toEqual({ ok: false, failure: 'rejected' })
    }
    expect(edges.create).not.toHaveBeenCalled()
    edges.create.mockResolvedValue({ id: 9 })
    await signUp(input)
    expect(edges.create.mock.calls[0]?.[0].data.role).toBe('guest')
    expect(Object.keys(edges.create.mock.calls[0]?.[0].data).sort()).toEqual([
      'email',
      'name',
      'password',
      'role',
    ])
  })

  const duplicate = () =>
    new ValidationError({
      errors: [{ message: 'A user with the given email is already registered.', path: 'email' }],
    })

  it('answers the same when an account already uses the email, and logs nothing', async () => {
    edges.create.mockRejectedValue(duplicate())
    edges.find.mockResolvedValue({ docs: [{ id: 9, email: 'ana@example.com', _verified: true }] })
    expect(await signUp(input)).toEqual({ ok: true })
    await runAfterTasks()
    expect(console.error).not.toHaveBeenCalled()
    // A verified account gets nothing
    expect(edges.sendEmail).not.toHaveBeenCalled()
    expect(edges.dbUpdateOne).not.toHaveBeenCalled()
  })

  it('answers the same when it fails on our side, and logs only the error’s name', async () => {
    edges.create.mockRejectedValue(new Error('SMTP down for ana@example.com'))
    edges.delete.mockResolvedValue({ docs: [] })
    expect(await signUp(input)).toEqual({ ok: true })
    expect(console.error).toHaveBeenCalledExactlyOnceWith('Sign-up failed on the server (Error)')
  })

  it('removes the unverified account it just stored when the verification email fails', async () => {
    edges.create.mockRejectedValue(new Error('SMTP down'))
    edges.delete.mockResolvedValue({ docs: [{ id: 9 }] })
    await signUp(input)
    expect(edges.delete).toHaveBeenCalledExactlyOnceWith({
      collection: 'users',
      where: {
        and: [
          { email: { equals: 'ana@example.com' } },
          { _verified: { not_equals: true } },
          { createdAt: { greater_than_equal: new Date().toISOString() } },
        ],
      },
      depth: 0,
      overrideAccess: true,
    })
  })

  it('never removes an account when Payload refuses a duplicate email', async () => {
    edges.create.mockRejectedValue(duplicate())
    edges.find.mockResolvedValue({ docs: [] })
    await signUp(input)
    await runAfterTasks()
    expect(edges.delete).not.toHaveBeenCalled()
  })

  it('still answers the same when removing the failed account fails too', async () => {
    edges.create.mockRejectedValue(new Error('SMTP down'))
    edges.delete.mockRejectedValue(new Error('Database locked'))
    expect(await signUp(input)).toEqual({ ok: true })
    expect(console.error).toHaveBeenLastCalledWith('Sign-up cleanup failed on the server (Error)')
  })

  it('sends the robot-check token to the check, and refuses before Payload when it fails', async () => {
    edges.create.mockResolvedValue({ id: 9 })
    await signUp(input, 'token-1')
    expect(robotCheck.verify).toHaveBeenCalledExactlyOnceWith('token-1')

    robotCheck.verify.mockResolvedValue({ ok: false, reason: 'missing-token' })
    expect(await signUp(input)).toEqual({ ok: false, failure: 'robot-check' })
    expect(robotCheck.verify).toHaveBeenLastCalledWith(null)
    expect(edges.create).toHaveBeenCalledTimes(1)
  })

  it('skips the robot check when it isn’t configured', async () => {
    robotCheck.enabled = false
    edges.create.mockResolvedValue({ id: 9 })
    expect(await signUp(input)).toEqual({ ok: true })
    expect(robotCheck.verify).not.toHaveBeenCalled()
  })

  it('allows five attempts an hour from one connection, then refuses before the check', async () => {
    edges.create.mockResolvedValue({ id: 9 })
    requestHeaders.set('x-forwarded-for', '203.0.113.7')
    for (let i = 0; i < 5; i++) expect(await signUp(input)).toEqual({ ok: true })
    expect(await signUp(input)).toEqual({ ok: false, failure: 'too-many' })
    expect(robotCheck.verify).toHaveBeenCalledTimes(5)
    // Another connection still gets through
    requestHeaders.set('x-forwarded-for', '203.0.113.8')
    expect(await signUp(input)).toEqual({ ok: true })
    // An hour later, the first connection can try again
    vi.setSystemTime(Date.now() + 60 * 60 * 1000)
    requestHeaders.set('x-forwarded-for', '203.0.113.7')
    expect(await signUp(input)).toEqual({ ok: true })
  })

  it('creates at most twenty accounts an hour site-wide', async () => {
    edges.create.mockResolvedValue({ id: 9 })
    for (let i = 0; i < 20; i++) {
      requestHeaders.set('x-forwarded-for', `198.51.100.${i}`)
      expect(await signUp(input)).toEqual({ ok: true })
    }
    requestHeaders.set('x-forwarded-for', '198.51.100.99')
    expect(await signUp(input)).toEqual({ ok: false, failure: 'too-many' })
    expect(edges.create).toHaveBeenCalledTimes(20)
  })

  it('doesn’t count failed robot checks against the site-wide limit', async () => {
    robotCheck.verify.mockResolvedValue({ ok: false, reason: 'bad' })
    for (let i = 0; i < 25; i++) {
      requestHeaders.set('x-forwarded-for', `192.0.2.${i}`)
      await signUp(input)
    }
    robotCheck.verify.mockResolvedValue({ ok: true })
    edges.create.mockResolvedValue({ id: 9 })
    expect(await signUp(input)).toEqual({ ok: true })
  })

  it('refuses input that doesn’t parse, without asking Payload', async () => {
    for (const values of [
      null,
      { ...input, name: ' ' },
      { ...input, email: 'not-an-email' },
      { ...input, email: 'a@example.com, b@example.com' },
      { ...input, confirmPassword: 'different' },
      { ...input, newPassword: 'short', confirmPassword: 'short' },
    ]) {
      expect(await signUp(values)).toEqual({ ok: false, failure: 'rejected' })
    }
    expect(edges.create).not.toHaveBeenCalled()
  })
})
