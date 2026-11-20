import { describe, expect, it } from 'vitest'

import { connectGoogleSchema, decideFinishLink, decideStartLink } from './googleLink'
import { RECENT_SIGN_IN_WINDOW_MS } from './signInSession'

const now = new Date('2026-11-20T12:00:00Z')
const ago = (ms: number) => new Date(now.getTime() - ms)

describe('decideStartLink', () => {
  it('needs a session whose sign-in is recent', () => {
    expect(decideStartLink({ accountId: 7, signedInAt: ago(1000), now })).toEqual({ ok: true })
    expect(
      decideStartLink({ accountId: 7, signedInAt: ago(RECENT_SIGN_IN_WINDOW_MS), now }),
    ).toEqual({
      ok: true,
    })
  })

  it('asks for a new sign-in when the session is old, unknown, in the future or missing', () => {
    const again = { ok: false, result: 'sign-in-again' }
    expect(
      decideStartLink({ accountId: 7, signedInAt: ago(RECENT_SIGN_IN_WINDOW_MS + 1), now }),
    ).toEqual(again)
    expect(decideStartLink({ accountId: 7, signedInAt: null, now })).toEqual(again)
    expect(decideStartLink({ accountId: 7, signedInAt: ago(-1000), now })).toEqual(again)
    expect(decideStartLink({ accountId: null, signedInAt: ago(1000), now })).toEqual(again)
  })
})

describe('decideFinishLink', () => {
  const session = { accountId: 7, signedInAt: ago(60_000) }
  const finish = (over: Partial<Parameters<typeof decideFinishLink>[0]> = {}) =>
    decideFinishLink({
      flowAccountId: 7,
      session,
      linkedAccountId: null,
      emailVerified: true,
      now,
      ...over,
    })

  it('links to the account that started the flow, while the sign-in is still recent', () => {
    expect(finish()).toEqual({ kind: 'link' })
  })

  it('asks for a new sign-in when it went old while the person was at Google, or is gone', () => {
    const again = { kind: 'refuse', result: 'sign-in-again' }
    expect(
      finish({ session: { accountId: 7, signedInAt: ago(RECENT_SIGN_IN_WINDOW_MS + 1) } }),
    ).toEqual(again)
    expect(finish({ session: null })).toEqual(again)
  })

  it('refuses a callback whose flow belongs to another account than the session', () => {
    expect(finish({ flowAccountId: 8 })).toEqual({ kind: 'refuse', result: 'failed' })
  })

  it('refuses a Google email Google didn’t verify, the same rule as signing in', () => {
    expect(finish({ emailVerified: false })).toEqual({ kind: 'refuse', result: 'failed' })
  })

  it('refuses a Google identity that is already on any account, this one included', () => {
    expect(finish({ linkedAccountId: 9 })).toEqual({ kind: 'refuse', result: 'taken' })
    expect(finish({ linkedAccountId: 7 })).toEqual({ kind: 'refuse', result: 'taken' })
  })
})

describe('connectGoogleSchema', () => {
  it('takes only a password, as typed', () => {
    expect(connectGoogleSchema.parse({ password: ' a b ' })).toEqual({ password: ' a b ' })
    expect(connectGoogleSchema.safeParse({ password: '' }).success).toBe(false)
    expect(connectGoogleSchema.safeParse({ password: 'x'.repeat(1025) }).success).toBe(false)
  })

  it('refuses a field the page doesn’t have, so no one names the account or the email', () => {
    expect(connectGoogleSchema.safeParse({ password: 'x', email: 'a@b.co' }).success).toBe(false)
    expect(connectGoogleSchema.safeParse({ password: 'x', id: 1 }).success).toBe(false)
  })
})
