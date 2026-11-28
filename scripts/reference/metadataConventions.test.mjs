import { describe, expect, it } from 'vitest'

import { describeMetadataFiles } from './metadataRoutes.mjs'

const urls = (files) => describeMetadataFiles(files).map((row) => row.url)

describe('metadata file conventions (#1461)', () => {
  it('takes each extension Next.js reads for a convention', () => {
    expect(
      urls([
        'robots.txt',
        'robots.js',
        'sitemap.xml',
        'sitemap.js',
        'favicon.ico',
        'manifest.json',
        'manifest.webmanifest',
        'manifest.js',
        'icon.ico',
        'icon.jpeg',
        'icon.jpg',
        'icon.png',
        'icon.tsx',
        'apple-icon.jpeg',
        'apple-icon.jpg',
        'apple-icon.js',
        'opengraph-image.gif',
        'opengraph-image.jpeg',
        'opengraph-image.js',
        'twitter-image.gif',
        'twitter-image.jpg',
        'twitter-image.tsx',
      ]),
    ).toHaveLength(22)
  })

  it('leaves out a file with another extension, or an extension only in part', () => {
    expect(
      urls([
        'robots.png',
        'robots.txt.bak',
        'sitemap.png',
        'favicon.png',
        'manifest.png',
        'icon.xml',
        'icon.t.s',
        'apple-icon.ico',
        'apple-icon.svg',
        'opengraph-image.svg',
        'opengraph-image.ico',
        'twitter-image.svg',
        'twitter-image.ico',
      ]),
    ).toEqual([])
  })

  it('writes the folders of a nested file into its URL, without the route groups', () => {
    expect(urls(['(a)/b/(c)/d/icon.png', 'x/y/sitemap.ts'])).toEqual([
      '/b/d/icon',
      '/x/y/sitemap.xml',
    ])
  })
})
