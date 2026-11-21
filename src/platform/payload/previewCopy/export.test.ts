import { beforeAll, describe, expect, it, vi } from 'vitest'

import {
  SECRET_EMAIL,
  seedAndExport,
  STAFF_EMAIL,
} from '@/platform/payload/testing/previewCopyProduction'

import { exportPreviewCopy } from './exportContent'
import { parsePreviewCopyFile, type PreviewCopyFile } from './file'

/**
 * The export, on real Payload with in-memory SQLite (#1396): a "production" database seeded with
 * published content and with everything that must stay behind, exported as a visitor.
 */

let production: Awaited<ReturnType<typeof seedAndExport>>['production']
let file: PreviewCopyFile
let counts: Awaited<ReturnType<typeof seedAndExport>>['counts']
let ids: Record<string, number>

beforeAll(async () => {
  ;({ production, file, counts, ids } = await seedAndExport())
}, 120_000)

const posts = () => file.collections.posts ?? []
const text = () => JSON.stringify(file)

describe('the export', () => {
  it('keeps each byline name but no user id, and gives each row an id of its own', () => {
    const rows = posts().flatMap(
      (p) => (p.populatedAuthors as { id: unknown; name: unknown }[]) ?? [],
    )
    expect(rows.length).toBeGreaterThan(1)
    expect(rows.every((row) => typeof row.name === 'string' && row.name.length > 0)).toBe(true)
    expect(rows.every((row) => typeof row.id === 'string' && row.id.includes('-'))).toBe(true)
    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length)
  })

  it('drops a property a collection hook adds on read', () => {
    expect(text()).not.toContain('hook-added-value')
    expect(posts().every((p) => !('leaked' in p))).toBe(true)
  })

  it('reads every collection and global as an anonymous visitor with access checked', async () => {
    const find = vi.spyOn(production, 'find')
    const findGlobal = vi.spyOn(production, 'findGlobal')
    await exportPreviewCopy(production)
    const calls = [...find.mock.calls, ...findGlobal.mock.calls]
    expect(calls.length).toBeGreaterThan(10)
    for (const [args] of calls) {
      expect(args).toMatchObject({ overrideAccess: false, draft: false, depth: 0 })
      expect(args).not.toHaveProperty('user')
      expect(args).not.toHaveProperty('req')
    }
  })

  it('holds only published documents, at their published version', () => {
    expect(
      posts()
        .map((p) => p.title)
        .sort(),
    ).toEqual(['Published title', 'Related', 'Second by the same author'])
    expect(text()).not.toContain('Draft edit title')
    expect(text()).not.toContain('Never published')
  })

  it('has no email address, no account, no submission and no recipient', () => {
    expect(text()).not.toMatch(/@/)
    expect(text()).not.toContain(SECRET_EMAIL)
    expect(text()).not.toContain(STAFF_EMAIL)
    expect(Object.keys(file.collections)).not.toContain('users')
    expect(Object.keys(file.collections)).not.toContain('form-submissions')
    const members = file.collections['team-members'] ?? []
    expect(members).toHaveLength(1)
    expect(members[0]).not.toHaveProperty('email')
    expect(file.collections.forms?.[0]).not.toHaveProperty('emails')
  })

  it('copies only classified fields: the author accounts and the review queue stay out', () => {
    const post = posts().find((p) => p.id === ids.post)
    expect(post).not.toHaveProperty('authors')
    expect(post).not.toHaveProperty('moderationStatus')
    expect(post).not.toHaveProperty('_status', 'draft')
    expect(Object.keys(post ?? {}).sort()).toEqual(
      expect.arrayContaining(['id', 'title', 'slug', 'heroImage']),
    )
  })

  it('follows references only to documents it copies itself', () => {
    const post = posts().find((p) => p.id === ids.post)
    expect(post?.relatedPosts).toEqual([ids.related])
    // The link's words stay; where it pointed does not
    expect(JSON.stringify(post?.content)).toContain('"doc":{"relationTo":"posts","value":null}')
    expect(JSON.stringify(post?.content)).toContain('draft link')
    const header = file.globals.header as { navItems: { link: { reference: unknown } }[] }
    expect(header.navItems[0]?.link.reference).toEqual({ relationTo: 'pages', value: 1 })
    expect(header.navItems[1]?.link.reference).toBeNull()
    expect(counts.droppedReferences).toBeGreaterThan(0)
  })

  it('copies only the pictures copied documents point at', () => {
    const copied = (file.collections.media ?? []).map((m) => m.alt).sort()
    expect(copied).toEqual(['Figure picture', 'Hero picture'])
    expect(file.mediaFiles).toEqual(['figure-300.jpg', 'figure.jpg', 'hero-300.jpg', 'hero.jpg'])
  })

  it('clears the folder link and keeps the upload metadata', () => {
    const hero = (file.collections.media ?? []).find((m) => m.alt === 'Hero picture')
    expect(hero).not.toHaveProperty('folder')
    expect(hero).toMatchObject({ filename: 'hero.jpg', mimeType: 'image/jpeg' })
  })

  it('round-trips through the file’s own parser', () => {
    expect(parsePreviewCopyFile(JSON.stringify(file))).toEqual(JSON.parse(text()))
  })
})
