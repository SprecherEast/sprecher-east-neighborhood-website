import { afterEach, describe, expect, it, vi } from 'vitest'

/** The config the build sees for one set of environment values */
async function envFor(values: Record<string, string>) {
  vi.resetModules()
  for (const [name, value] of Object.entries(values)) vi.stubEnv(name, value)
  const { default: nextConfigForPhase } = await import('../../next.config.js')
  const config = await nextConfigForPhase('phase-development-server')
  return config.env as Record<string, string>
}

describe('public settings pinned at build', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('builds the visit counter site ID and the robot check site key into the pages', async () => {
    const env = await envFor({
      NEXT_PUBLIC_UMAMI_WEBSITE_ID: 'a969368e-4514-4aa9-828a-fb0cd9d8330b',
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
    })

    expect(env.NEXT_PUBLIC_UMAMI_WEBSITE_ID).toBe('a969368e-4514-4aa9-828a-fb0cd9d8330b')
    expect(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY).toBe('1x00000000000000000000AA')
  })

  it('pins an empty value when a setting is unset, so server and browser agree', async () => {
    const env = await envFor({
      NEXT_PUBLIC_UMAMI_WEBSITE_ID: '',
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: '',
    })

    expect(env).toMatchObject({
      NEXT_PUBLIC_UMAMI_WEBSITE_ID: '',
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: '',
    })
  })
})
