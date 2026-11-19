import { describe, expect, it, vi } from 'vitest'

import { isGalleryEnabled } from './isGalleryEnabled'

describe('isGalleryEnabled (#466)', () => {
  it('is on under next dev', () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect(isGalleryEnabled()).toBe(true)
  })

  it.each(['production', 'test', ''])('is off when NODE_ENV is "%s"', (value) => {
    vi.stubEnv('NODE_ENV', value)
    expect(isGalleryEnabled()).toBe(false)
  })
})
