import { beforeEach, describe, expect, it, vi } from 'vitest'

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

const { connectGoogleWithPassword } = await import('./connectGoogle')

const pending = { provider: 'google', subject: 'g-1', email: 'ana@example.com' }
const guest = { id: 7, role: 'guest', verified: true, lockedUntil: null }
const recent = () => ({
  accountId: 7,
  email: 'ana@example.com',
  signedInAt: new Date(Date.now() - 60_000),
})

// Each test is a different connection, so the limit counts each on its own
let connection = 0
const connect = (password = 'right', ip = `10.1.0.${++connection}`) =>
  connectGoogleWithPassword({ password }, ip)

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

describe('connectGoogleWithPassword (the password step at sign-in)', () => {
  it('links Google and signs in only after the right password for the verified email', async () => {
    expect(await connect()).toEqual({ ok: true })
    // The email is the one Google verified, read from the record: never from input
    expect(data.isPasswordFor).toHaveBeenCalledWith('ana@example.com', 'right')
    expect(data.linkSubject).toHaveBeenCalledWith(7, 'google', 'g-1')
    expect(data.startSessionFor).toHaveBeenCalledWith(7)
    expect(data.sendEmailToAccount).toHaveBeenCalledOnce()
  })

  it('writes the link before it signs in', async () => {
    const order: string[] = []
    data.linkSubject.mockImplementation(async () => (order.push('link'), true))
    data.startSessionFor.mockImplementation(async () => void order.push('session'))
    await connect()
    expect(order).toEqual(['link', 'session'])
  })

  it('refuses a wrong password with the one failure, and links and signs in nothing', async () => {
    data.isPasswordFor.mockResolvedValue(false)
    expect(await connect('wrong')).toEqual({ ok: false, failure: 'failed' })
    expect(data.linkSubject).not.toHaveBeenCalled()
    expect(data.startSessionFor).not.toHaveBeenCalled()
    expect(data.sendEmailToAccount).not.toHaveBeenCalled()
  })

  it('uses the record up on every try: the cookie and the row are taken once, a wrong password included', async () => {
    data.isPasswordFor.mockResolvedValue(false)
    await connect('wrong')
    expect(data.takePendingLinkCookie).toHaveBeenCalledOnce()
    expect(data.takePendingLink).toHaveBeenCalledWith(31, expect.any(Date))
  })

  it.each([
    ['no cookie', () => data.takePendingLinkCookie.mockResolvedValue(null)],
    ['an expired, used or replayed record', () => data.takePendingLink.mockResolvedValue(null)],
  ])('gives the one failure for %s, without checking any password', async (_, arrange) => {
    arrange()
    expect(await connect()).toEqual({ ok: false, failure: 'failed' })
    expect(data.isPasswordFor).not.toHaveBeenCalled()
    expect(data.startSessionFor).not.toHaveBeenCalled()
  })

  it.each([
    ['a locked account', { lockedUntil: new Date('2999-01-01') }],
    ['an unverified account', { verified: false }],
    ['an agent account', { role: 'agent' }],
  ])('gives the one failure for %s even with the right password', async (_, over) => {
    data.findAccountByEmail.mockResolvedValue({ ...guest, ...over })
    expect(await connect()).toEqual({ ok: false, failure: 'failed' })
    expect(data.linkSubject).not.toHaveBeenCalled()
    expect(data.startSessionFor).not.toHaveBeenCalled()
  })

  it('gives the one failure when no account uses the email any more', async () => {
    data.findAccountByEmail.mockResolvedValue(null)
    expect(await connect()).toEqual({ ok: false, failure: 'failed' })
  })

  it('refuses a Google identity that is already on an account, and changes nothing', async () => {
    data.findAccountBySubject.mockResolvedValue({ ...guest, id: 9 })
    expect(await connect()).toEqual({ ok: false, failure: 'failed' })
    expect(data.linkSubject).not.toHaveBeenCalled()
    expect(data.startSessionFor).not.toHaveBeenCalled()
  })

  it('does not sign in when the link was not written (the account has a Google id already)', async () => {
    data.linkSubject.mockResolvedValue(false)
    expect(await connect()).toEqual({ ok: false, failure: 'failed' })
    expect(data.startSessionFor).not.toHaveBeenCalled()
    expect(data.sendEmailToAccount).not.toHaveBeenCalled()
  })

  it('turns any failure on our side into the same one failure, logged', async () => {
    data.isPasswordFor.mockRejectedValue(new Error('db down'))
    expect(await connect()).toEqual({ ok: false, failure: 'failed' })
    expect(console.error).toHaveBeenCalled()
  })

  it('stops one connection after 30 tries an hour, before the record is touched', async () => {
    data.isPasswordFor.mockResolvedValue(false)
    for (let i = 0; i < 30; i++) await connect('wrong', '10.9.9.9')
    data.takePendingLinkCookie.mockClear()
    expect(await connect('right', '10.9.9.9')).toEqual({ ok: false, failure: 'too-many' })
    expect(data.takePendingLinkCookie).not.toHaveBeenCalled()
  })
})
