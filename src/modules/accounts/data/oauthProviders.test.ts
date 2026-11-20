import type * as OpenIdClient from 'openid-client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

// openid-client is replaced: these tests check what this site asks of it and does with its
// answers. Its own checks (state, nonce, PKCE, the ID token) are its tests' job.
const oidc = vi.hoisted(() => ({
  discovery: vi.fn(),
  buildAuthorizationUrl: vi.fn(),
  authorizationCodeGrant: vi.fn(),
  calculatePKCECodeChallenge: vi.fn(),
}))
vi.mock('openid-client', async (importActual) => {
  const actual = await importActual<typeof OpenIdClient>()
  return {
    ...actual,
    discovery: oidc.discovery,
    buildAuthorizationUrl: oidc.buildAuthorizationUrl,
    authorizationCodeGrant: oidc.authorizationCodeGrant,
    calculatePKCECodeChallenge: oidc.calculatePKCECodeChallenge,
  }
})

const { authorizationUrl, finishAuthorization, newSocialFlow } = await import('./oauthProviders')

const googleFlow = { provider: 'google' as const, state: 's', codeVerifier: 'v', nonce: 'n', linkAccountId: null }
const callback = new URL('https://sprechereast.com/auth/google/callback?code=c&state=s')

beforeEach(() => {
  for (const fn of Object.values(oidc)) fn.mockReset()
  vi.stubEnv('GOOGLE_CLIENT_ID', 'google-id')
  vi.stubEnv('GOOGLE_CLIENT_SECRET', 'google-secret')
  oidc.discovery.mockResolvedValue({ google: true })
  oidc.buildAuthorizationUrl.mockReturnValue(new URL('https://provider.example/auth'))
  oidc.calculatePKCECodeChallenge.mockResolvedValue('challenge')
})
afterEach(() => vi.unstubAllEnvs())

describe('newSocialFlow', () => {
  it('makes a fresh state, PKCE verifier and nonce each time', () => {
    const a = newSocialFlow('google')
    const b = newSocialFlow('google')
    expect(a.provider).toBe('google')
    expect(a.state).not.toBe(b.state)
    expect(a.codeVerifier).not.toBe(b.codeVerifier)
    expect(a.nonce).not.toBe(b.nonce)
  })
})

describe('authorizationUrl', () => {
  it('asks Google for the person’s email with state, nonce and PKCE', async () => {
    await authorizationUrl(googleFlow, 'https://sprechereast.com/auth/google/callback')
    expect(oidc.buildAuthorizationUrl).toHaveBeenCalledWith(
      { google: true },
      expect.objectContaining({
        redirect_uri: 'https://sprechereast.com/auth/google/callback',
        scope: 'openid email profile',
        state: 's',
        nonce: 'n',
        code_challenge: 'challenge',
        code_challenge_method: 'S256',
        prompt: 'select_account',
      }),
    )
  })
})

describe('finishAuthorization', () => {
  it('checks Google’s answer against the flow and reads the ID token', async () => {
    oidc.authorizationCodeGrant.mockResolvedValue({
      claims: () => ({ sub: 'g-1', email: ' Ana@Example.com ', email_verified: true, name: 'Ana' }),
    })
    expect(await finishAuthorization(googleFlow, callback)).toEqual({
      provider: 'google',
      subject: 'g-1',
      email: 'ana@example.com',
      emailVerified: true,
      name: 'Ana',
    })
    expect(oidc.authorizationCodeGrant).toHaveBeenCalledWith({ google: true }, callback, {
      expectedState: 's',
      expectedNonce: 'n',
      pkceCodeVerifier: 'v',
      idTokenExpected: true,
    })
  })

  it('counts a Google email as verified only when Google says exactly true', async () => {
    oidc.authorizationCodeGrant.mockResolvedValue({
      claims: () => ({ sub: 'g-1', email: 'a@example.com', email_verified: 'true' }),
    })
    expect((await finishAuthorization(googleFlow, callback)).emailVerified).toBe(false)
  })

  it('throws when Google sends no ID token', async () => {
    oidc.authorizationCodeGrant.mockResolvedValue({ claims: () => undefined })
    await expect(finishAuthorization(googleFlow, callback)).rejects.toThrow('no ID token')
  })

  it('throws when the provider is off', async () => {
    vi.stubEnv('GOOGLE_CLIENT_SECRET', '')
    await expect(finishAuthorization(googleFlow, callback)).rejects.toThrow('off')
  })
})
