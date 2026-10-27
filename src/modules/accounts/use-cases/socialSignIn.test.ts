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
}))
vi.mock('../data/oauthProviders', () => ({
  newSocialFlow: data.newSocialFlow,
  authorizationUrl: data.authorizationUrl,
  finishAuthorization: data.finishAuthorization,
}))
vi.mock('../data/socialAccounts', () => ({
  findAccountBySubject: data.findAccountBySubject,
  findAccountByEmail: data.findAccountByEmail,
  createVerifiedAccount: data.createVerifiedAccount,
  startSessionFor: data.startSessionFor,
  saveSocialFlow: data.saveSocialFlow,
  takeSocialFlow: data.takeSocialFlow,
}))

const { finishSocialSignIn, startSocialSignIn } = await import('./socialSignIn')

const flow = { provider: 'google', state: 's', codeVerifier: 'v', nonce: 'n' }
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

  it('refuses an address an account already uses, and links nothing', async () => {
    data.findAccountByEmail.mockResolvedValue(guest)
    expect(await finish()).toBe('/login?social=email-in-use')
    expect(data.startSessionFor).not.toHaveBeenCalled()
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
