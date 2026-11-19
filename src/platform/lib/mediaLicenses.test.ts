import { describe, expect, it } from 'vitest'

import { toLicenseName } from './mediaLicenses'

describe('toLicenseName', () => {
  it('reads the version from a Creative Commons license link', () => {
    expect(toLicenseName('cc-by-sa', 'https://creativecommons.org/licenses/by-sa/2.0/')).toBe(
      'CC BY-SA 2.0',
    )
    expect(toLicenseName('cc-by', 'https://creativecommons.org/licenses/by/4.0/deed.en')).toBe(
      'CC BY 4.0',
    )
    expect(toLicenseName('cc0', 'https://creativecommons.org/publicdomain/zero/1.0/')).toBe(
      'CC0 1.0',
    )
  })

  it('names the license without a version when the link has none', () => {
    expect(toLicenseName('cc-by', null)).toBe('CC BY')
    expect(toLicenseName('cc-by', 'https://example.com/license')).toBe('CC BY')
  })

  it('adds no version from a link to a different license', () => {
    expect(toLicenseName('cc-by', 'https://creativecommons.org/licenses/by-sa/4.0/')).toBe('CC BY')
    expect(toLicenseName('cc-by', 'https://example.com/creativecommons.org/licenses/by/4.0/')).toBe(
      'CC BY',
    )
  })

  it('tells CC0 from the Public Domain Mark, and keeps the combined name otherwise', () => {
    expect(toLicenseName('cc0', 'https://creativecommons.org/publicdomain/mark/1.0/')).toBe(
      'Public domain',
    )
    expect(toLicenseName('cc0', null)).toBe('CC0 or public domain')
    expect(toLicenseName('cc0', 'https://example.com/pd')).toBe('CC0 or public domain')
  })

  it('names no license for our own photos, permission, other or none', () => {
    expect(toLicenseName('own', null)).toBeNull()
    expect(toLicenseName('permission', null)).toBeNull()
    expect(toLicenseName('other', null)).toBeNull()
    expect(toLicenseName(null, null)).toBeNull()
  })
})
