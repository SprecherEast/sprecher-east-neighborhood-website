import { describe, expect, it } from 'vitest'

import { umamiConfig } from './umami'

const ID = 'a969368e-4514-4aa9-828a-fb0cd9d8330b'

describe('umamiConfig (#950)', () => {
  it('names the script on the stats address of the site’s domain', () => {
    expect(umamiConfig(ID, 'https://sprechereast.com')).toEqual({
      src: 'https://stats.sprechereast.com/script.js',
      websiteId: ID,
      domains: 'sprechereast.com',
    })
  })

  it('keeps the stats address on the bare domain, and counts both spellings of a www site', () => {
    const config = umamiConfig(ID, 'https://www.sprechereast.com')
    expect(config?.src).toBe('https://stats.sprechereast.com/script.js')
    expect(config?.domains).toBe('www.sprechereast.com,sprechereast.com')
  })

  it.each([
    undefined,
    '',
    '  ',
    'not-an-id',
    // The same values the deploy preflight refuses (.github/scripts/umami-id-gate.test.mjs)
    '------------------------------------',
    'a969368e-4514-4aa9-828a-fb0cd9d8330',
    'a969368e45144aa9828afb0cd9d8330b0000',
    'g969368e-4514-4aa9-828a-fb0cd9d8330b',
  ])('counts nothing for the ID %j', (id) => {
    expect(umamiConfig(id, 'https://sprechereast.com')).toBeNull()
  })

  it.each(['http://localhost:3000', 'http://127.0.0.1:3000', 'http://[::1]:3000', 'nonsense'])(
    'counts nothing on %s, which has no real domain',
    (url) => {
      expect(umamiConfig(ID, url)).toBeNull()
    },
  )
})
