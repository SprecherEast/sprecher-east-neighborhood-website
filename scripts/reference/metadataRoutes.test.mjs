import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'

import { collectAppFiles, describeMetadataFiles, publicEntries } from './metadataRoutes.mjs'

describe('describeMetadataFiles', () => {
  it('turns each metadata file convention into the URL Next.js serves it at', () => {
    const rows = describeMetadataFiles([
      'robots.ts',
      'sitemap.ts',
      'favicon.ico',
      'icon.svg',
      'apple-icon.png',
      'manifest.ts',
      '(frontend)/events/opengraph-image.tsx',
      'twitter-image.png',
    ])
    expect(rows.map((row) => [row.url, row.file, row.generated])).toEqual([
      ['/apple-icon', 'src/app/apple-icon.png', false],
      ['/events/opengraph-image', 'src/app/(frontend)/events/opengraph-image.tsx', true],
      ['/favicon.ico', 'src/app/favicon.ico', false],
      ['/icon', 'src/app/icon.svg', false],
      ['/manifest.webmanifest', 'src/app/manifest.ts', true],
      ['/robots.txt', 'src/app/robots.ts', true],
      ['/sitemap.xml', 'src/app/sitemap.ts', true],
      ['/twitter-image', 'src/app/twitter-image.png', false],
    ])
  })

  it('sorts two files that give the same URL by file name', () => {
    expect(describeMetadataFiles(['icon.svg', 'icon.png']).map((row) => row.file)).toEqual([
      'src/app/icon.png',
      'src/app/icon.svg',
    ])
  })

  it('ignores tests, other files, and a top-level-only file in a folder', () => {
    expect(
      describeMetadataFiles([
        'sitemap.test.ts',
        'icons.test.ts',
        'layout.tsx',
        'a/robots.ts',
        'a/favicon.ico',
        'a/manifest.ts',
      ]),
    ).toEqual([])
  })
})

describe('collectAppFiles and publicEntries', () => {
  it('reads the app folder, says which generated file calls Payload, and lists public/', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reference-meta-'))
    const write = (file, text) => {
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
      fs.writeFileSync(path.join(root, file), text)
    }
    write('src/app/sitemap.ts', 'const p = await getPayload({ config })\n')
    write('src/app/robots.ts', 'export default () => ({})\n')
    write(
      'src/app/(frontend)/events/sitemap.ts',
      "import { list } from '@/modules/events/server'\n",
    )
    write('src/app/sitemap.test.ts', '')
    write('public/brand/logo.svg', '')
    write('public/ads.txt', '')
    const found = [
      collectAppFiles(root),
      publicEntries(root),
      publicEntries(path.join(root, 'none')),
    ]
    fs.rmSync(root, { recursive: true, force: true })
    expect(found[0].map((row) => [row.url, row.readsContent])).toEqual([
      ['/events/sitemap.xml', true],
      ['/robots.txt', false],
      ['/sitemap.xml', true],
    ])
    expect(found[1]).toEqual(['/ads.txt', '/brand/…'])
    expect(found[2]).toEqual([])
  })
})

describe('publicEntries order', () => {
  it('lists the entries sorted, whatever order the folder is read in', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true)
    vi.spyOn(fs, 'readdirSync').mockReturnValue([
      { name: 'zebra.txt', isDirectory: () => false },
      { name: 'brand', isDirectory: () => true },
      { name: 'ads.txt', isDirectory: () => false },
    ])
    expect(publicEntries('/any')).toEqual(['/ads.txt', '/brand/…', '/zebra.txt'])
  })
})
