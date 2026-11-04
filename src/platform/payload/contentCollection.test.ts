import type { PayloadRequest } from 'payload'
import { describe, expect, it } from 'vitest'

import { TITLE_MAX_LENGTH } from '@/platform/lib'

import { draftVersions, previewAdmin, titleField } from './contentCollection'

const req = {} as PayloadRequest
const preview = (collection: 'posts' | 'events' | 'pages', data: Record<string, unknown>) =>
  previewAdmin(collection).preview?.(data, { req, locale: 'en', token: null })

describe('previewAdmin', () => {
  it('opens the real page from the draft, for the Preview button and Live Preview alike', async () => {
    const admin = previewAdmin('events')
    const url = (admin.livePreview as { url: (a: unknown) => unknown }).url({
      data: { slug: 'park-cleanup' },
      req,
    })

    expect(url).toContain('collection=events')
    expect(url).toContain('path=%2Fevents%2Fpark-cleanup')
    expect(preview('events', { slug: 'park-cleanup' })).toBe(url)
  })

  it('has no preview for a document without a slug yet', () => {
    expect(preview('posts', {})).toBeNull()
    expect(preview('posts', { slug: 7 })).toBeNull()
  })

  it('keeps each collection’s address prefix, and the home page’s empty slug', () => {
    expect(preview('posts', { slug: 'a' })).toContain('path=%2Fposts%2Fa')
    expect(preview('pages', { slug: 'about' })).toContain('path=%2Fabout')
    expect(preview('pages', { slug: '' })).not.toBeNull()
  })
})

describe('draftVersions', () => {
  it('turns on drafts with autosave and scheduled publishing, keeping this many versions', () => {
    expect(draftVersions(25)).toEqual({
      drafts: { autosave: { interval: 100 }, schedulePublish: true },
      maxPerDoc: 25,
    })
  })

  it('gives each collection its own object, which Payload may change', () => {
    expect(draftVersions(50)).not.toBe(draftVersions(50))
  })
})

describe('titleField', () => {
  it('is a required text field called title', () => {
    expect(titleField()).toMatchObject({ name: 'title', type: 'text', required: true })
  })

  it('stops at the one shared limit, and tells the editor why (#633)', () => {
    const field = titleField() as { maxLength?: number; admin?: { description?: string } }

    expect(field.maxLength).toBe(TITLE_MAX_LENGTH)
    expect(field.admin?.description).toContain(String(TITLE_MAX_LENGTH))
    expect(field.admin?.description).toMatch(/breadcrumb/i)
  })
})
