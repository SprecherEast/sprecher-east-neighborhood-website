import { describe, expect, it, vi } from 'vitest'

import { NOT_INDEXED } from '@/platform/seo/notIndexed'

import { metadata } from './layout'

vi.mock('next/font/local', () => ({ default: () => ({ variable: 'font-poppins' }) }))

describe('the developer pages layout', () => {
  it('keeps every page out of search results (the host sends the header too)', () => {
    expect(metadata.robots).toEqual(NOT_INDEXED)
  })

  it('is unofficial: the title says it is a developer page, not the neighborhood site', () => {
    expect(metadata.title).toMatchObject({ default: expect.stringMatching(/developer/i) })
  })
})
