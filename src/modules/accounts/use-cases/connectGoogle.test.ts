import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SocialProfile } from '../domain/socialSignIn'

vi.mock('server-only', () => ({}))
// `after` runs its callback at once, so what is sent after the answer can be read
vi.mock('next/server', () => ({ after: (fn: () => unknown) => void fn() }))

const data = vi.hoisted(() => ({
  sendEmailToAccount: vi.fn(),
  getSignInSession: vi.fn(),
  isPasswordFor: vi.fn(),
  startSessionFor: vi.fn(),
  findAccountByEmail: vi.fn(),
  findAccountBySubject: vi.fn(),
  hasLinkedSubject: vi.fn(),
  linkSubject: vi.fn(),
  isPendingLinkOpen: vi.fn(),
  readPendingLinkCookie: vi.fn(),
  takePendingLink: vi.fn(),
  takePendingLinkCookie: vi.fn(),
}))
vi.mock('../data/accountEmail', () => ({ sendEmailToAccount: data.sendEmailToAccount }))
vi.mock('../data/session', () => ({
  getSignInSession: data.getSignInSession,
  isPasswordFor: data.isPasswordFor,
  startSessionFor: data.startSessionFor,
}))
vi.mock('../data/socialAccounts', () => ({
  findAccountByEmail: data.findAccountByEmail,
  findAccountBySubject: data.findAccountBySubject,
  hasLinkedSubject: data.hasLinkedSubject,
  linkSubject: data.linkSubject,
}))
vi.mock('../data/socialLinkRequests', () => ({
  isPendingLinkOpen: data.isPendingLinkOpen,
  readPendingLinkCookie: data.readPendingLinkCookie,
  takePendingLink: data.takePendingLink,
  takePendingLinkCookie: data.takePendingLinkCookie,
}))

const { beginGoogleLink, finishGoogleLink, getGoogleConnection, hasPendingGoogleLink, toAccount } =
  await import('./connectGoogle')

const now = new Date()
const profile: SocialProfile = {
  provider: 'google',
  subject: 'g-1',
  email: 'ana@example.com',
  emailVerified: true,
  name: 'Ana',
}
const pending = { provider: 'google', subject: 'g-1', email: 'ana@example.com' }
const guest = { id: 7, role: 'guest', verified: true, lockedUntil: null }
const recent = () => ({
  accountId: 7,
  email: 'ana@example.com',
  signedInAt: new Date(Date.now() - 60_000),
})

beforeEach(() => {
  for (const fn of Object.values(data)) fn.mockReset()
  vi.stubEnv('GOOGLE_CLIENT_ID', 'google-id')
  vi.stubEnv('GOOGLE_CLIENT_SECRET', 'google-secret')
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  data.takePendingLinkCookie.mockResolvedValue(31)
  data.takePendingLink.mockResolvedValue(pending)
  data.isPasswordFor.mockResolvedValue(true)
  data.findAccountByEmail.mockResolvedValue(guest)
  data.findAccountBySubject.mockResolvedValue(null)
  data.hasLinkedSubject.mockResolvedValue(false)
  data.linkSubject.mockResolvedValue(true)
  data.getSignInSession.mockResolvedValue(recent())
})

describe('getGoogleConnection', () => {
  it('is off without Google’s keys, and says whether the account has Google otherwise', async () => {
    expect(await getGoogleConnection(7)).toBe('available')
    data.hasLinkedSubject.mockResolvedValue(true)
    expect(await getGoogleConnection(7)).toBe('connected')
    vi.stubEnv('GOOGLE_CLIENT_SECRET', '')
    expect(await getGoogleConnection(7)).toBe('off')
  })
})

describe('beginGoogleLink (from the account page)', () => {
  it('binds the flow to the session’s account when the sign-in is recent', async () => {
    expect(await beginGoogleLink('google', now)).toEqual({ ok: true, accountId: 7 })
  })

  it('asks for a new sign-in when the session is old or gone', async () => {
    const again = { ok: false, to: '/account?social=sign-in-again' }
    data.getSignInSession.mockResolvedValue({
      ...recent(),
      signedInAt: new Date(Date.now() - 6 * 60_000),
    })
    expect(await beginGoogleLink('google', new Date())).toEqual(again)
    data.getSignInSession.mockResolvedValue(null)
    expect(await beginGoogleLink('google', new Date())).toEqual(again)
  })

  it('has nothing to connect when the account already has Google', async () => {
    data.hasLinkedSubject.mockResolvedValue(true)
    expect(await beginGoogleLink('google', new Date())).toEqual({ ok: false, to: '/account' })
  })

  it('starts nothing from a link on another site, and reads no session there', async () => {
    expect(await beginGoogleLink('google', now, { fromAnotherSite: true })).toEqual({
      ok: false,
      to: '/account',
    })
    expect(data.getSignInSession).not.toHaveBeenCalled()
  })
})

describe('finishGoogleLink (from the account page)', () => {
  it('attaches Google to the session’s account and notes it, with no link in the note', async () => {
    expect(await finishGoogleLink(7, profile, new Date())).toBe('/account?social=linked')
    expect(data.linkSubject).toHaveBeenCalledWith(7, 'google', 'g-1')
    expect(data.sendEmailToAccount).toHaveBeenCalledOnce()
    const [to, email] = data.sendEmailToAccount.mock.calls[0]
    expect(to).toBe('ana@example.com')
    expect(email.text).not.toMatch(/https?:/)
  })

  it('refuses when the sign-in went old at Google, writing nothing', async () => {
    data.getSignInSession.mockResolvedValue({
      ...recent(),
      signedInAt: new Date(Date.now() - 6 * 60_000),
    })
    expect(await finishGoogleLink(7, profile, new Date())).toBe('/account?social=sign-in-again')
    expect(data.linkSubject).not.toHaveBeenCalled()
  })

  it('refuses a Google email Google didn’t verify, linking and noting nothing', async () => {
    expect(await finishGoogleLink(7, { ...profile, emailVerified: false }, new Date())).toBe(
      '/account?social=failed',
    )
    expect(data.linkSubject).not.toHaveBeenCalled()
    expect(data.sendEmailToAccount).not.toHaveBeenCalled()
  })

  it('refuses a flow that belongs to another account than the session', async () => {
    expect(await finishGoogleLink(8, profile, new Date())).toBe('/account?social=failed')
    expect(data.linkSubject).not.toHaveBeenCalled()
    expect(data.sendEmailToAccount).not.toHaveBeenCalled()
  })

  it('refuses with no session at all', async () => {
    data.getSignInSession.mockResolvedValue(null)
    expect(await finishGoogleLink(7, profile, new Date())).toBe('/account?social=sign-in-again')
    expect(data.linkSubject).not.toHaveBeenCalled()
  })

  it('refuses a Google identity already on any account, and changes nothing', async () => {
    data.findAccountBySubject.mockResolvedValue({ ...guest, id: 9 })
    expect(await finishGoogleLink(7, profile, new Date())).toBe('/account?social=taken')
    expect(data.linkSubject).not.toHaveBeenCalled()
  })

  it('answers failed, and sends no note, when the link isn’t written (the account already has one)', async () => {
    data.linkSubject.mockResolvedValue(false)
    expect(await finishGoogleLink(7, profile, new Date())).toBe('/account?social=failed')
    expect(data.sendEmailToAccount).not.toHaveBeenCalled()
  })

  it('logs a failure as the fixed message only', async () => {
    data.linkSubject.mockRejectedValue(new Error('db down: secret detail'))
    expect(await finishGoogleLink(7, profile, new Date())).toBe('/account?social=failed')
    expect(console.error).toHaveBeenCalled()
  })

  it('never lets a failed note undo the link', async () => {
    data.sendEmailToAccount.mockRejectedValue(new Error('smtp down'))
    expect(await finishGoogleLink(7, profile, new Date())).toBe('/account?social=linked')
  })
})

describe('hasPendingGoogleLink', () => {
  it('is true only for a cookie whose record is still open, and reads without taking', async () => {
    data.readPendingLinkCookie.mockResolvedValue(31)
    data.isPendingLinkOpen.mockResolvedValue(true)
    expect(await hasPendingGoogleLink()).toBe(true)
    data.isPendingLinkOpen.mockResolvedValue(false)
    expect(await hasPendingGoogleLink()).toBe(false)
    data.readPendingLinkCookie.mockResolvedValue(null)
    expect(await hasPendingGoogleLink()).toBe(false)
    expect(data.takePendingLink).not.toHaveBeenCalled()
  })
})

describe('toAccount', () => {
  it('sends a fixed code to the account page', () => {
    expect(toAccount('linked')).toBe('/account?social=linked')
  })
})
