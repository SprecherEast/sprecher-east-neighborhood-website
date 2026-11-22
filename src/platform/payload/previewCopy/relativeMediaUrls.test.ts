import { describe, expect, it } from 'vitest'

import { relativeMediaUrls } from './relativeMediaUrls'

describe('relativeMediaUrls', () => {
  it('makes the picture, thumbnail and each size address path and query only', () => {
    const doc = {
      id: 1,
      alt: 'Park',
      url: 'http://localhost:3000/api/media/file/park.webp',
      thumbnailURL: 'http://localhost:3000/api/media/file/park-300x200.webp?v=2',
      sizes: {
        card: { url: 'http://localhost:3000/api/media/file/park-600.webp', width: 600 },
        hero: { url: null, width: null },
      },
    }
    expect(relativeMediaUrls(doc)).toEqual({
      id: 1,
      alt: 'Park',
      url: '/api/media/file/park.webp',
      thumbnailURL: '/api/media/file/park-300x200.webp?v=2',
      sizes: {
        card: { url: '/api/media/file/park-600.webp', width: 600 },
        hero: { url: null, width: null },
      },
    })
  })

  it('leaves relative addresses and a record without them unchanged', () => {
    const doc = { id: 2, url: '/api/media/file/a.webp', thumbnailURL: null }
    expect(relativeMediaUrls(doc)).toEqual(doc)
    expect(relativeMediaUrls({ id: 3 })).toEqual({ id: 3 })
  })

  it('does not change the record it is given', () => {
    const doc = { url: 'https://sprechereast.com/api/media/file/a.webp' }
    relativeMediaUrls(doc)
    expect(doc.url).toBe('https://sprechereast.com/api/media/file/a.webp')
  })
})
