import { afterEach, describe, expect, it, vi } from 'vitest'

import { getPasskeyRelyingParty } from './passkeySettings'

vi.mock('server-only', () => ({}))

afterEach(() => vi.unstubAllEnvs())

const configure = (env: Record<string, string>) => {
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value)
}

describe('getPasskeyRelyingParty: the one place the switch is read (#1313)', () => {
  it('is off, with no relying party, unless the setting is true', () => {
    configure({ NEXT_PUBLIC_SERVER_URL: 'https://sprechereast.com', NODE_ENV: 'production' })
    expect(getPasskeyRelyingParty()).toBeNull()
    configure({ PASSKEYS_ENABLED: 'false' })
    expect(getPasskeyRelyingParty()).toBeNull()
  })

  it('gives the live domain when on in production', () => {
    configure({
      PASSKEYS_ENABLED: 'true',
      NEXT_PUBLIC_SERVER_URL: 'https://sprechereast.com',
      NODE_ENV: 'production',
    })
    expect(getPasskeyRelyingParty()).toEqual({
      id: 'sprechereast.com',
      origin: 'https://sprechereast.com',
    })
  })

  it('gives localhost in development', () => {
    configure({
      PASSKEYS_ENABLED: 'true',
      NEXT_PUBLIC_SERVER_URL: 'http://localhost:3000',
      NODE_ENV: 'development',
    })
    expect(getPasskeyRelyingParty()).toEqual({ id: 'localhost', origin: 'http://localhost:3000' })
  })

  it('stays off in production when the site address is missing and falls back to localhost', () => {
    configure({ PASSKEYS_ENABLED: 'true', NEXT_PUBLIC_SERVER_URL: '', NODE_ENV: 'production' })
    expect(getPasskeyRelyingParty()).toBeNull()
  })

  it('takes the address from the configuration, never from a request', () => {
    configure({
      PASSKEYS_ENABLED: 'true',
      NEXT_PUBLIC_SERVER_URL: 'https://pr-9.preview.sprechereast.com',
      NODE_ENV: 'production',
    })
    // The function takes no request at all
    expect(getPasskeyRelyingParty.length).toBe(0)
    expect(getPasskeyRelyingParty()?.id).toBe('pr-9.preview.sprechereast.com')
  })
})
