import { describe, expect, it } from 'vitest'

import type { Media } from '@/payload-types'

import { resolveBandBackdrop, type BandBackdrop } from './bandBackdrop'

const photo = (id: number) =>
  ({ id, alt: `Photo ${id}`, url: `/api/media/file/${id}.jpg` }) as Media

const none: BandBackdrop = { phone: null, tablet: null, desktop: null }

describe('resolveBandBackdrop', () => {
  it('has no photo to draw when no crop is set, which leaves the plain band', () => {
    expect(resolveBandBackdrop(none)).toEqual([])
  })

  it('has nothing to draw when there is no backdrop at all', () => {
    expect(resolveBandBackdrop(null)).toEqual([])
    expect(resolveBandBackdrop(undefined)).toEqual([])
  })

  it('gives each screen size its own crop, one photo per size', () => {
    const [phone, tablet, desktop] = [photo(1), photo(2), photo(3)]
    expect(resolveBandBackdrop({ phone, tablet, desktop })).toEqual([
      { image: phone, sizes: ['phone'] },
      { image: tablet, sizes: ['tablet'] },
      { image: desktop, sizes: ['desktop'] },
    ])
  })

  it('draws a photo once when several sizes use it', () => {
    const one = photo(1)
    expect(resolveBandBackdrop({ phone: one, tablet: one, desktop: one })).toEqual([
      { image: one, sizes: ['phone', 'tablet', 'desktop'] },
    ])
  })

  it('lets a size with no crop of its own use the nearest one that is set', () => {
    const [phone, desktop] = [photo(1), photo(3)]
    // The tablet takes the desktop crop (the wider one) before the phone's
    expect(resolveBandBackdrop({ ...none, phone, desktop })).toEqual([
      { image: phone, sizes: ['phone'] },
      { image: desktop, sizes: ['tablet', 'desktop'] },
    ])
  })

  it('lets a lone crop serve every size', () => {
    const desktop = photo(3)
    expect(resolveBandBackdrop({ ...none, desktop })).toEqual([
      { image: desktop, sizes: ['phone', 'tablet', 'desktop'] },
    ])
    const phone = photo(1)
    expect(resolveBandBackdrop({ ...none, phone })).toEqual([
      { image: phone, sizes: ['phone', 'tablet', 'desktop'] },
    ])
  })
})
