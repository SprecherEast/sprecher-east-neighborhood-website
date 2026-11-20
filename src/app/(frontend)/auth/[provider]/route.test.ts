import { beforeEach, describe, expect, it, vi } from 'vitest'

// The accounts module is replaced: these test the routes' wiring, not the sign-in
const mocks = vi.hoisted(() => ({
  startSocialSignIn: vi.fn(),
  finishSocialSignIn: vi.fn(),
  continuePage: vi.fn(() => new Response('continue')),
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT ${path}`)
  }),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))
vi.mock('@/modules/accounts/server', () => ({
  startSocialSignIn: mocks.startSocialSignIn,
  finishSocialSignIn: mocks.finishSocialSignIn,
  continuePage: mocks.continuePage,
}))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect, notFound: mocks.notFound }))
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.9' }),
}))

import { GET as callback } from './callback/route'
import { GET as link } from './link/route'
import { GET as start } from './route'

const params = (provider: string) => ({ params: Promise.resolve({ provider }) })
const callbackRequest = (search: string) =>
  Object.assign(new Request(`https://sprechereast.com/auth/google/callback${search}`), {
    nextUrl: new URL(`https://sprechereast.com/auth/google/callback${search}`),
  }) as never

beforeEach(() => {
  for (const fn of Object.values(mocks)) fn.mockClear()
})

describe('/auth/[provider]', () => {
  it('sends the person where the module answers', async () => {
    mocks.startSocialSignIn.mockResolvedValue('https://accounts.google.com/auth')
    await expect(
      start(new Request('https://sprechereast.com/auth/google'), params('google')),
    ).rejects.toThrow('NEXT_REDIRECT https://accounts.google.com/auth')
    expect(mocks.startSocialSignIn).toHaveBeenCalledWith('google', '203.0.113.9')
  })

  it('answers 404 for a provider the site doesn’t know', async () => {
    await expect(
      start(new Request('https://sprechereast.com/auth/apple'), params('apple')),
    ).rejects.toThrow('NEXT_NOT_FOUND')
    expect(mocks.startSocialSignIn).not.toHaveBeenCalled()
  })
})

describe('/auth/[provider]/link', () => {
  it('starts the flow as a link from the session, so the module binds it to the account', async () => {
    mocks.startSocialSignIn.mockResolvedValue('https://accounts.google.com/auth')
    await expect(
      link(new Request('https://sprechereast.com/auth/google/link'), params('google')),
    ).rejects.toThrow('NEXT_REDIRECT https://accounts.google.com/auth')
    expect(mocks.startSocialSignIn).toHaveBeenCalledWith('google', '203.0.113.9', { link: true })
  })

  it('answers 404 for a provider the site doesn’t know', async () => {
    await expect(
      link(new Request('https://sprechereast.com/auth/apple/link'), params('apple')),
    ).rejects.toThrow('NEXT_NOT_FOUND')
    expect(mocks.startSocialSignIn).not.toHaveBeenCalled()
  })

  it('takes no account from the address: a plain start never binds one', async () => {
    mocks.startSocialSignIn.mockResolvedValue('https://accounts.google.com/auth')
    await expect(
      start(new Request('https://sprechereast.com/auth/google?link=1&account=9'), params('google')),
    ).rejects.toThrow()
    expect(mocks.startSocialSignIn).toHaveBeenCalledWith('google', '203.0.113.9')
  })
})

describe('/auth/[provider]/callback', () => {
  it('sends a connect that ended back to the account page with a plain redirect', async () => {
    mocks.finishSocialSignIn.mockResolvedValue('/account?social=linked')
    await expect(callback(callbackRequest('?code=c&state=s'), params('google'))).rejects.toThrow(
      'NEXT_REDIRECT /account?social=linked',
    )
    expect(mocks.continuePage).not.toHaveBeenCalled()
  })

  it('sends the password step with a plain redirect, signed in to nothing', async () => {
    mocks.finishSocialSignIn.mockResolvedValue('/auth/google/connect')
    await expect(callback(callbackRequest('?code=c&state=s'), params('google'))).rejects.toThrow(
      'NEXT_REDIRECT /auth/google/connect',
    )
    expect(mocks.continuePage).not.toHaveBeenCalled()
  })

  it('hands the answer and the connection to the module, and moves a signed-in person on', async () => {
    mocks.finishSocialSignIn.mockResolvedValue('/account')
    const response = await callback(callbackRequest('?code=c&state=s'), params('google'))
    expect(mocks.finishSocialSignIn).toHaveBeenCalledWith(
      'google',
      '?code=c&state=s',
      '203.0.113.9',
    )
    expect(await response.text()).toBe('continue')
  })

  it('redirects to the log-in page with the module’s message', async () => {
    mocks.finishSocialSignIn.mockResolvedValue('/login?social=failed')
    await expect(
      callback(callbackRequest('?error=access_denied'), params('google')),
    ).rejects.toThrow('NEXT_REDIRECT /login?social=failed')
    expect(mocks.continuePage).not.toHaveBeenCalled()
  })
})
