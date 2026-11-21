import type { Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import {
  asStaff as as,
  freshPayload,
  seedAndExport,
} from '@/platform/payload/testing/previewCopyProduction'
import { paragraph } from '@/platform/payload/testing/inMemoryPayload'

import { parsePreviewCopyFile, type PreviewCopyFile } from './file'
import { importPreviewCopy } from './importContent'
import { reindexSearch } from './reindexSearch'

/**
 * The import, on real Payload with in-memory SQLite (#1396): a file the export made from a seeded
 * "production" database, imported into a second, fresh database.
 */

let config: Awaited<ReturnType<typeof seedAndExport>>['config']
let file: PreviewCopyFile
let ids: Record<string, number>
const text = () => JSON.stringify(file)

beforeAll(async () => {
  ;({ config, file, ids } = await seedAndExport())
}, 120_000)

describe('the import', () => {
  let preview: Payload
  let imported: Awaited<ReturnType<typeof importPreviewCopy>>

  beforeAll(async () => {
    // A second database: libsql opens a fresh in-memory one for each Payload instance
    preview = await freshPayload(config, 'preview-copy-target')
    imported = await importPreviewCopy(preview, parsePreviewCopyFile(text()))
    await reindexSearch(preview)
  }, 120_000)

  it('restores the same ids and relationships', async () => {
    const post = await preview.findByID({
      collection: 'posts',
      id: ids.post as number,
      depth: 0,
      ...as,
    })
    expect(post.title).toBe('Published title')
    expect(post.relatedPosts).toEqual([ids.related])
    expect(post.heroImage).toBe(ids.heroMedia)
    const child = await preview.findByID({
      collection: 'categories',
      id: ids.child as number,
      depth: 0,
      ...as,
    })
    expect(child.parent).toBe(ids.parent)
    expect(imported.created.posts).toBe(3)
  })

  it('leaves accounts, submissions, drafts and version tables empty', async () => {
    for (const collection of ['users', 'form-submissions', 'payload-mcp-api-keys'] as const) {
      expect((await preview.count({ collection, ...as })).totalDocs, collection).toBe(0)
    }
    expect((await preview.count({ collection: 'posts', ...as })).totalDocs).toBe(3)
    const versions = await preview.countVersions({ collection: 'posts', ...as })
    expect(versions.totalDocs).toBe(0)
    expect(
      (
        await preview.count({
          collection: 'posts',
          where: { _status: { not_equals: 'published' } },
          ...as,
        })
      ).totalDocs,
    ).toBe(0)
  })

  it('shows the published posts to a visitor, and the copied header', async () => {
    const visible = await preview.find({ collection: 'posts', depth: 0, overrideAccess: false })
    expect(visible.docs).toHaveLength(3)
    const header = await preview.findGlobal({ slug: 'header', depth: 0 })
    expect(header.navItems).toHaveLength(2)
  })

  it('indexes the copied posts for search through the plugin', async () => {
    const entries = await preview.find({ collection: 'search', depth: 0, ...as })
    expect(entries.docs.map((d) => d.title).sort()).toEqual([
      'Published title',
      'Related',
      'Second by the same author',
    ])
  })

  it('writes a document that points at one later in the file', async () => {
    const reordered = JSON.parse(text()) as PreviewCopyFile
    const [parent, child] = reordered.collections.categories as [
      Record<string, unknown> & { id: number },
      Record<string, unknown> & { id: number },
    ]
    // The child comes first, and two posts point at each other
    reordered.collections.categories = [child, parent]
    const [related, main] = ['related', 'main-post'].map((slug) =>
      reordered.collections.posts?.find((p) => p.slug === slug),
    )
    if (related && main) {
      related.relatedPosts = [main.id]
      main.relatedPosts = [related.id]
    }
    const target = await freshPayload(config, 'preview-copy-target-3')
    await importPreviewCopy(target, parsePreviewCopyFile(JSON.stringify(reordered)))
    const row = await target.findByID({ collection: 'categories', id: child.id, depth: 0, ...as })
    expect(row.parent).toBe(parent.id)
    const post = await target.findByID({
      collection: 'posts',
      id: main?.id as number,
      depth: 0,
      ...as,
    })
    expect(post.relatedPosts).toEqual([related?.id])
  })

  it('leaves out, in the second pass too, a reference to a document the file lacks', async () => {
    const odd = JSON.parse(text()) as PreviewCopyFile
    const [related, main] = ['related', 'main-post'].map((slug) =>
      odd.collections.posts?.find((p) => p.slug === slug),
    )
    // The first post points ahead (a second pass) and also at something that is not in the file
    if (related && main) related.relatedPosts = [main.id, 999_999]
    const target = await freshPayload(config, 'preview-copy-target-4')
    await importPreviewCopy(target, parsePreviewCopyFile(JSON.stringify(odd)))
    const post = await target.findByID({
      collection: 'posts',
      id: related?.id as number,
      depth: 0,
      ...as,
    })
    expect(post.relatedPosts).toEqual([main?.id])
  })

  it('counts a field this build no longer has instead of failing', async () => {
    const stale = JSON.parse(text()) as PreviewCopyFile
    stale.collections.faq = [{ id: 40, question: 'Q?', answer: paragraph('A'), removedField: 'x' }]
    const target = await freshPayload(config, 'preview-copy-target-2')
    const result = await importPreviewCopy(target, parsePreviewCopyFile(JSON.stringify(stale)))
    expect(result.skippedFields).toBe(1)
    expect(result.created.faq).toBe(1)
  })
})
