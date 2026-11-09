import { describe, expect, it } from 'vitest'

import { umamiConfig } from './umami'

const ID = 'a969368e-4514-4aa9-828a-fb0cd9d8330b'

describe('umamiConfig (#950)', () => {
  it('names the script on the stats address of the site’s domain', () => {
    expect(umamiConfig(ID, 'https://sprechereast.com')).toEqual({
      src: 'https://stats.sprechereast.com/script.js',
      websiteId: ID,
      domain: 'sprechereast.com',
    })
  })

  it('treats www. and the bare domain alike', () => {
    expect(umamiConfig(ID, 'https://www.sprechereast.com')?.src).toBe(
      'https://stats.sprechereast.com/script.js',
    )
  })

  it.each([undefined, '', '  ', 'not-an-id'])('counts nothing for the ID %j', (id) => {
    expect(umamiConfig(id, 'https://sprechereast.com')).toBeNull()
  })

  it.each(['http://localhost:3000', 'http://127.0.0.1:3000', 'http://[::1]:3000', 'nonsense'])(
    'counts nothing on %s, which has no real domain',
    (url) => {
      expect(umamiConfig(ID, url)).toBeNull()
    },
  )
})
