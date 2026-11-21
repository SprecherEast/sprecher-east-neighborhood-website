import { describe, expect, it } from 'vitest'

import { isSafeFileName, parsePreviewCopyFile, PREVIEW_COPY_FORMAT } from './file'

/** The shape the import trusts nothing beyond (#1396). */

const valid = {
  format: PREVIEW_COPY_FORMAT,
  collections: { posts: [{ id: 1, title: 'A' }], media: [{ id: 'a1' }] },
  globals: { header: { navItems: [] } },
  mediaFiles: ['hero.jpg', 'hero-300.jpg'],
}
const parse = (value: unknown) => parsePreviewCopyFile(JSON.stringify(value))

describe('parsePreviewCopyFile', () => {
  it('reads a file the export wrote', () => {
    expect(parse(valid)).toEqual(valid)
  })

  it('refuses text that is not JSON, or has another format', () => {
    expect(() => parsePreviewCopyFile('{')).toThrow(/not JSON/)
    expect(() => parse({ ...valid, format: 2 })).toThrow(/unknown format/)
    expect(() => parse([])).toThrow(/unknown format/)
    expect(() => parse({ format: 1 })).toThrow(/missing/)
  })

  it('refuses a collection or global the classification does not copy', () => {
    for (const slug of ['users', 'form-submissions', 'search', 'nonsense']) {
      expect(() => parse({ ...valid, collections: { [slug]: [] } }), slug).toThrow(/not copied/)
      expect(() => parse({ ...valid, globals: { [slug]: {} } }), slug).toThrow(/not copied/)
    }
  })

  it('refuses a document without an id', () => {
    expect(() => parse({ ...valid, collections: { posts: [{ title: 'A' }] } })).toThrow(
      /without an id/,
    )
    expect(() => parse({ ...valid, collections: { posts: [null] } })).toThrow(/without an id/)
    expect(() => parse({ ...valid, collections: { posts: {} } })).toThrow(/without an id/)
  })

  it('refuses a media file name that could leave the folder', () => {
    for (const name of [
      '../x.jpg',
      'a/b.jpg',
      'a\\b.jpg',
      '.hidden',
      '',
      'a\u0000.jpg',
      '-rf',
      5,
      null,
    ]) {
      expect(() => parse({ ...valid, mediaFiles: [name] }), String(name)).toThrow(/unsafe/)
    }
  })
})

describe("a media record's own file names", () => {
  it('are checked as the list is: the file and each size', () => {
    const media = (record: unknown) => parse({ ...valid, collections: { media: [record] } })
    expect(() => media({ id: 1, filename: '../x.jpg' })).toThrow(/unsafe/)
    expect(() =>
      media({ id: 1, filename: 'a.jpg', sizes: { thumb: { filename: 'b/c.jpg' } } }),
    ).toThrow(/unsafe/)
    expect(() =>
      media({ id: 1, filename: 'a.jpg', sizes: { thumb: { filename: null } } }),
    ).not.toThrow()
  })
})

describe('isSafeFileName', () => {
  it('accepts a plain name, with spaces and dots inside', () => {
    expect(isSafeFileName('Door Creek shelter.v2-300.jpg')).toBe(true)
  })
})
