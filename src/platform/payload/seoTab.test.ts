import { describe, expect, it } from 'vitest'

import { seoTab } from './seoTab'

describe('seoTab', () => {
  it('is the "SEO" tab that stores its fields under `meta`', () => {
    const tab = seoTab()

    expect(tab.name).toBe('meta')
    expect(tab.label).toBe('SEO')
  })

  it('holds the five SEO fields: overview, title, image, description and preview', () => {
    const tab = seoTab()

    expect(tab.fields).toHaveLength(5)
  })

  it('returns a new tab each time, so a collection cannot change another one’s tab', () => {
    expect(seoTab()).not.toBe(seoTab())
    expect(seoTab().fields).not.toBe(seoTab().fields)
  })
})
