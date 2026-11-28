import { describe, expect, it } from 'vitest'

import { isFromAnotherSite } from './fetchMetadata'

describe('isFromAnotherSite', () => {
  it('is true for a request the browser says began on another site', () => {
    const visit = {
      'sec-fetch-site': 'cross-site',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-dest': 'document',
    }
    expect(isFromAnotherSite(new Headers(visit))).toBe(true)
    expect(isFromAnotherSite(new Headers({ 'sec-fetch-site': 'cross-site' }))).toBe(true)
  })

  it.each(['same-origin', 'same-site', 'none'])('is false for `%s`', (site) => {
    expect(isFromAnotherSite(new Headers({ 'sec-fetch-site': site }))).toBe(false)
  })

  it('is false without the header, which Payload judges on its own', () => {
    expect(isFromAnotherSite(new Headers())).toBe(false)
  })
})
