import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SocialProfile } from '../domain/socialSignIn'

vi.mock('server-only', () => ({}))

const data = vi.hoisted(() => ({
  newSocialFlow: vi.fn(),
  authorizationUrl: vi.fn(),
  finishAuthorization: vi.fn(),
  findAccountBySubject: vi.fn(),
  findAccountByEmail: vi.fn(),
  createVerifiedAccount: vi.fn(),
  startSessionFor: vi.fn(),
  saveSocialFlow: vi.fn(),
  takeSocialFlow: vi.fn(),
  createPendingLink: vi.fn(),
  savePendingLinkCookie: vi.fn(),
  beginGoogleLink: vi.fn(),
  finishGoogleLink: vi.fn(),
}))
vi.mock('../data/oauthProviders', () => ({
  newSocialFlow: data.newSocialFlow,
  authorizationUrl: data.authorizationUrl,
  finishAuthorization: data.finishAuthorization,
}))
vi.mock('../data/session', () => ({ startSessionFor: data.startSessionFor }))
vi.mock('../data/socialAccounts', () => ({
  findAccountBySubject: data.findAccountBySubject,
  findAccountByEmail: data.findAccountByEmail,
  createVerifiedAccount: data.createVerifiedAccount,
  saveSocialFlow: data.saveSocialFlow,
  takeSocialFlow: data.takeSocialFlow,
}))

vi.mock('../data/socialLinkRequests', () => ({
  createPendingLink: data.createPendingLink,
  savePendingLinkCookie: data.savePendingLinkCookie,
}))
vi.mock('./connectGoogle', () => ({
  beginGoogleLink: data.beginGoogleLink,
  finishGoogleLink: data.finishGoogleLink,
  toAccount: (result: string) => `/account?social=${result}`,
}))

const { finishSocialSignIn, startSocialSignIn } = await import('./socialSignIn')

const flow = { provider: 'google', state: 's', codeVerifier: 'v', nonce: 'n', linkAccountId: null }
const profile = (over: Partial<SocialProfile> = {}): SocialProfile => ({
  provider: 'google',
  subject: 'g-1',
  email: 'ana@example.com',
  emailVerified: true,
  name: 'Ana',
  ...over,
})
const guest = { id: 7, role: 'guest', verified: true, lockedUntil: null }

// Each test is a different connection, so the new-account limit counts each on its own
let connection = 0
const finish = (ip = `10.0.0.${++connection}`) =>
  finishSocialSignIn('google', '?code=c&state=s', ip)

beforeEach(() => {
  for (const fn of Object.values(data)) fn.mockReset()
  vi.stubEnv('GOOGLE_CLIENT_ID', 'google-id')
  vi.stubEnv('GOOGLE_CLIENT_SECRET', 'google-secret')
  vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://sprechereast.com')
  data.takeSocialFlow.mockResolvedValue(flow)
  data.finishAuthorization.mockResolvedValue(profile())
  data.findAccountBySubject.mockResolvedValue(null)
  data.findAccountByEmail.mockResolvedValue(null)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('startSocialSignIn', () => {
  it('keeps the checks in this browser and sends the person to the provider', async () => {
    data.newSocialFlow.mockReturnValue(flow)
    data.authorizationUrl.mockResolvedValue(new URL('https://accounts.google.com/o/oauth2/auth?x'))
    expect(await startSocialSignIn('google', '10.1.1.1')).toBe(
      'https://accounts.google.com/o/oauth2/auth?x',
    )
    expect(data.authorizationUrl).toHaveBeenCalledWith(
      flow,
      'https://sprechereast.com/auth/google/callback',
    )
    expect(data.saveSocialFlow).toHaveBeenCalledWith(flow, expect.any(Date))
  })

  it('stops one connection after 30 starts an hour, and answers the fixed message', async () => {
    data.newSocialFlow.mockReturnValue(flow)
    data.authorizationUrl.mockResolvedValue(new URL('https://accounts.google.com/o/oauth2/auth?x'))
    const answers = []
    for (let i = 0; i < 31; i++) answers.push(await startSocialSignIn('google', '10.8.8.8'))
    expect(answers.slice(0, 30)).toEqual(
      Array(30).fill('https://accounts.google.com/o/oauth2/auth?x'),
    )
    expect(answers[30]).toBe('/login?social=too-many')
  })

  it('spends nothing shared by starts from many connections', async () => {
    data.newSocialFlow.mockReturnValue(flow)
    data.authorizationUrl.mockResolvedValue(new URL('https://accounts.google.com/o/oauth2/auth?x'))
    data.findAccountBySubject.mockResolvedValue(guest)
    // Each from its own connection: the limits count per connection, with no shared budget
    for (let i = 0; i < 700; i++) await startSocialSignIn('google', `10.50.${i >> 8}.${i & 255}`)
    expect(await finishSocialSignIn('google', '?code=c&state=s', '10.60.0.1')).toBe('/account')
  })

  it('starts a link from the account page bound to the session’s account', async () => {
    data.beginGoogleLink.mockResolvedValue({ ok: true, accountId: 7 })
    data.newSocialFlow.mockReturnValue({ ...flow, linkAccountId: 7 })
    data.authorizationUrl.mockResolvedValue(new URL('https://accounts.google.com/o/oauth2/auth?x'))
    await startSocialSignIn('google', '10.2.2.2', { link: true })
    expect(data.newSocialFlow).toHaveBeenCalledWith('google', 7)
    expect(data.saveSocialFlow).toHaveBeenCalledOnce()
  })

  it('sends a link start that is refused where the module says, starting nothing', async () => {
    data.beginGoogleLink.mockResolvedValue({ ok: false, to: '/account?social=sign-in-again' })
    expect(await startSocialSignIn('google', '10.2.2.3', { link: true })).toBe(
      '/account?social=sign-in-again',
    )
    expect(data.saveSocialFlow).not.toHaveBeenCalled()
    expect(data.authorizationUrl).not.toHaveBeenCalled()
  })

  it('answers the account page, not the log-in page, when a link can’t start', async () => {
    vi.stubEnv('GOOGLE_CLIENT_SECRET', '')
    expect(await startSocialSignIn('google', '10.2.2.4', { link: true })).toBe(
      '/account?social=failed',
    )
  })

  it('never starts a plain sign-in bound to an account', async () => {
    data.newSocialFlow.mockReturnValue(flow)
    data.authorizationUrl.mockResolvedValue(new URL('https://accounts.google.com/o/oauth2/auth?x'))
    await startSocialSignIn('google', '10.2.2.5')
    expect(data.beginGoogleLink).not.toHaveBeenCalled()
    expect(data.newSocialFlow).toHaveBeenCalledWith('google', null)
  })

  it('answers the log-in page when the provider is off or can’t be reached', async () => {
    vi.stubEnv('GOOGLE_CLIENT_SECRET', '')
    expect(await startSocialSignIn('google', '10.1.1.1')).toBe('/login?social=failed')
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'google-secret')
    data.newSocialFlow.mockReturnValue(flow)
    data.authorizationUrl.mockRejectedValue(new Error('discovery failed'))
    expect(await startSocialSignIn('google', '10.1.1.1')).toBe('/login?social=failed')
    expect(data.saveSocialFlow).not.toHaveBeenCalled()
  })
})

describe('finishSocialSignIn', () => {
  it('refuses a callback this browser didn’t start', async () => {
    data.takeSocialFlow.mockResolvedValue(null)
    expect(await finish()).toBe('/login?social=failed')
    expect(data.finishAuthorization).not.toHaveBeenCalled()
  })

  it('checks the answer on this site’s own callback address', async () => {
    data.findAccountBySubject.mockResolvedValue(guest)
    await finish()
    expect(data.finishAuthorization).toHaveBeenCalledWith(
      flow,
      new URL('https://sprechereast.com/auth/google/callback?code=c&state=s'),
    )
  })

  it('logs a failed check and shows only the fixed message', async () => {
    data.finishAuthorization.mockRejectedValue(new Error('state mismatch'))
    expect(await finish()).toBe('/login?social=failed')
    expect(console.error).toHaveBeenCalledOnce()
    expect(data.startSessionFor).not.toHaveBeenCalled()
  })

  it('signs a returning person in to their account', async () => {
    data.findAccountBySubject.mockResolvedValue(guest)
    expect(await finish()).toBe('/account')
    expect(data.startSessionFor).toHaveBeenCalledWith(7)
    expect(data.createVerifiedAccount).not.toHaveBeenCalled()
    expect(data.findAccountByEmail).not.toHaveBeenCalled()
  })

  it('creates a verified guest for a new address and signs them in', async () => {
    data.createVerifiedAccount.mockResolvedValue(12)
    expect(await finish()).toBe('/account')
    expect(data.createVerifiedAccount).toHaveBeenCalledWith(profile())
    expect(data.startSessionFor).toHaveBeenCalledWith(12)
  })

  it('asks for the password when an account already uses the address, and signs in nothing', async () => {
    data.findAccountByEmail.mockResolvedValue(guest)
    data.createPendingLink.mockResolvedValue(31)
    expect(await finish()).toBe('/auth/google/connect')
    expect(data.createPendingLink).toHaveBeenCalledWith(profile(), expect.any(Date))
    expect(data.savePendingLinkCookie).toHaveBeenCalledWith(31, expect.any(Date))
    expect(data.startSessionFor).not.toHaveBeenCalled()
    expect(data.createVerifiedAccount).not.toHaveBeenCalled()
  })

  it('asks for the password whatever state the account is in, so the answer is the same', async () => {
    data.createPendingLink.mockResolvedValue(31)
    for (const over of [
      { verified: false },
      { role: 'agent' },
      { lockedUntil: new Date('2999-01-01') },
    ]) {
      data.findAccountByEmail.mockResolvedValue({ ...guest, ...over })
      expect(await finish()).toBe('/auth/google/connect')
    }
    expect(data.startSessionFor).not.toHaveBeenCalled()
  })

  it('never asks for a password for an email Google didn’t verify', async () => {
    data.finishAuthorization.mockResolvedValue(profile({ emailVerified: false }))
    data.findAccountByEmail.mockResolvedValue(guest)
    expect(await finish()).toBe('/login?social=failed')
    expect(data.createPendingLink).not.toHaveBeenCalled()
  })

  it('signs a returning Google identity in by its id, without a password step', async () => {
    data.findAccountBySubject.mockResolvedValue(guest)
    data.findAccountByEmail.mockResolvedValue({ ...guest, id: 99 })
    expect(await finish()).toBe('/account')
    expect(data.startSessionFor).toHaveBeenCalledWith(7)
    expect(data.createPendingLink).not.toHaveBeenCalled()
  })

  it('hands a flow started from the account page to the link step, after the checks', async () => {
    data.takeSocialFlow.mockResolvedValue({ ...flow, linkAccountId: 7 })
    data.finishGoogleLink.mockResolvedValue('/account?social=linked')
    expect(await finish()).toBe('/account?social=linked')
    expect(data.finishGoogleLink).toHaveBeenCalledWith(7, profile(), expect.any(Date))
    expect(data.startSessionFor).not.toHaveBeenCalled()
    expect(data.createVerifiedAccount).not.toHaveBeenCalled()
  })

  it('sends a failed check of a link flow back to the account page', async () => {
    data.takeSocialFlow.mockResolvedValue({ ...flow, linkAccountId: 7 })
    data.finishAuthorization.mockRejectedValue(new Error('state mismatch'))
    expect(await finish()).toBe('/account?social=failed')
    expect(data.finishGoogleLink).not.toHaveBeenCalled()
  })

  it('stops one connection’s callbacks past the limit, before any call to the provider', async () => {
    data.findAccountBySubject.mockResolvedValue(guest)
    for (let i = 0; i < 30; i++) await finish('10.7.7.7')
    data.finishAuthorization.mockClear()
    expect(await finish('10.7.7.7')).toBe('/login?social=too-many')
    expect(data.finishAuthorization).not.toHaveBeenCalled()
  })

  it('spends nothing shared by callbacks that carry no flow', async () => {
    data.takeSocialFlow.mockResolvedValue(null)
    // Callbacks with no flow cost nothing outbound, and there is no shared budget to use up
    for (let i = 0; i < 700; i++) await finish(`10.70.${i >> 8}.${i & 255}`)
    data.takeSocialFlow.mockResolvedValue(flow)
    data.findAccountBySubject.mockResolvedValue(guest)
    expect(await finish('10.71.0.1')).toBe('/account')
  })

  it('stops new accounts from one connection past the sign-up limit', async () => {
    data.createVerifiedAccount.mockResolvedValue(12)
    const answers = []
    for (let i = 0; i < 6; i++) answers.push(await finish('10.9.9.9'))
    expect(answers.slice(0, 5)).toEqual(Array(5).fill('/account'))
    expect(answers[5]).toBe('/login?social=too-many')
  })
})
