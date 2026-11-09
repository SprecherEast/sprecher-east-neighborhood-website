import { isValidElement, type ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { UmamiScript } from './UmamiScript'

const ID = 'a969368e-4514-4aa9-828a-fb0cd9d8330b'

function rendered() {
  const element = UmamiScript()
  return isValidElement(element) ? (element as ReactElement<Record<string, unknown>>) : null
}

describe('UmamiScript (#950)', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('draws the script with the site ID, after the page, honoring Do Not Track', () => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://sprechereast.com')
    vi.stubEnv('NEXT_PUBLIC_UMAMI_WEBSITE_ID', ID)

    expect(rendered()?.props).toMatchObject({
      src: 'https://stats.sprechereast.com/script.js',
      strategy: 'afterInteractive',
      defer: true,
      'data-website-id': ID,
      'data-domains': 'sprechereast.com',
      'data-do-not-track': 'true',
      // Tokens, emails and search words live in the query string; it must never leave the page
      'data-exclude-search': 'true',
    })
  })

  it('draws nothing when no site ID is set', () => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://sprechereast.com')
    vi.stubEnv('NEXT_PUBLIC_UMAMI_WEBSITE_ID', '')

    expect(UmamiScript()).toBeNull()
  })

  it('draws nothing on a local address, even with an ID', () => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'http://localhost:3000')
    vi.stubEnv('NEXT_PUBLIC_UMAMI_WEBSITE_ID', ID)

    expect(UmamiScript()).toBeNull()
  })
})
