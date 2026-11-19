import { describe, expect, it } from 'vitest'

import type { Post } from '@/payload-types'

import { toPostDetail, toPostSummary } from './mappers'

const post: Post = {
  id: 7,
  slug: 'council-recap',
  title: 'Council recap',
  content: {
    root: { type: 'root', children: [], direction: null, format: '', indent: 0, version: 1 },
  },
  updatedAt: '2026-10-02T12:00:00.000Z',
  createdAt: '2026-09-30T12:00:00.000Z',
}

describe('the post source (#483)', () => {
  const legistar = 'https://madison.legistar.com/Calendar.aspx'
  const sourceOf = (sourceName: string | null, sourceUrl: string | null) =>
    toPostSummary({ ...post, sourceName, sourceUrl }).source

  it('keeps the name and the link when both are set', () => {
    expect(sourceOf('City of Madison', legistar)).toEqual({
      name: 'City of Madison',
      url: legistar,
    })
  })

  it('keeps a name without a link as text only', () => {
    expect(sourceOf('  Dane County  ', null)).toEqual({ name: 'Dane County', url: null })
  })

  it('names a link without a name by its host', () => {
    expect(sourceOf(null, legistar)).toEqual({ name: 'madison.legistar.com', url: legistar })
    expect(sourceOf('   ', 'http://example.com/a')).toEqual({
      name: 'example.com',
      url: 'http://example.com/a',
    })
  })

  it('has no source when neither is set', () => {
    expect(sourceOf(null, null)).toBeNull()
    expect(toPostSummary({ id: 3, slug: 'hello', title: 'Hello' }).source).toBeNull()
  })

  it.each([
    'javascript:alert(1)',
    'ftp://example.com/minutes.pdf',
    '/posts/elsewhere',
    'madison.legistar.com',
    'data:text/html,hi',
  ])('never keeps %s as a link, from old or bad data', (url) => {
    expect(sourceOf('City of Madison', url)).toEqual({ name: 'City of Madison', url: null })
    expect(sourceOf(null, url)).toBeNull()
  })

  it('carries the source to the post page too', () => {
    expect(toPostDetail({ ...post, sourceName: 'City of Madison' }).source).toEqual({
      name: 'City of Madison',
      url: null,
    })
  })
})
