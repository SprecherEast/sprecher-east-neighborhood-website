// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DISMISSED_BANNERS_KEY,
  isBannerDismissed,
  rememberBannerDismissed,
} from './dismissedBanners'

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('dismissed banners', () => {
  it('starts with nothing dismissed', () => {
    expect(isBannerDismissed('a1')).toBe(false)
  })

  it('remembers the ids that were closed, and only those', () => {
    rememberBannerDismissed('a1')
    rememberBannerDismissed('b2')
    rememberBannerDismissed('a1')

    expect(isBannerDismissed('a1')).toBe(true)
    expect(isBannerDismissed('b2')).toBe(true)
    expect(isBannerDismissed('c3')).toBe(false)
    expect(JSON.parse(localStorage.getItem(DISMISSED_BANNERS_KEY) ?? '[]')).toEqual(['a1', 'b2'])
  })

  it('ignores stored data that is not a list of ids', () => {
    localStorage.setItem(DISMISSED_BANNERS_KEY, '{"oops":1}')
    expect(isBannerDismissed('a1')).toBe(false)
    localStorage.setItem(DISMISSED_BANNERS_KEY, 'not json')
    expect(isBannerDismissed('a1')).toBe(false)
  })

  it('shows the banner and does not throw when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    expect(isBannerDismissed('a1')).toBe(false)
    expect(() => rememberBannerDismissed('a1')).not.toThrow()
  })
})
