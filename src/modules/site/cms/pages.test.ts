import type { Block, Field, PayloadRequest } from 'payload'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { draftContentAccess } from '@/platform/payload/draftContentAccess'
import { populatePublishedAt } from '@/platform/payload/populatePublishedAt'

import { createPagesCollection } from './pages'
import { revalidateDelete, revalidatePage } from './revalidatePage'
import { SITE_LAYOUT_BLOCKS } from './layoutBlocks'

const block = (slug: string): Block => ({ slug, fields: [] })

/** The `layout` blocks field inside the Pages collection's tabs. */
const layoutField = (fields: Field[]) => {
  for (const field of fields) {
    if (field.type === 'tabs') {
      for (const tab of field.tabs) {
        const layout = tab.fields.find((f) => 'name' in f && f.name === 'layout')
        if (layout?.type === 'blocks') return layout
      }
    }
  }
  throw new Error('Pages has no layout field')
}

describe('createPagesCollection', () => {
  it('offers the layout blocks it is given, in that order', () => {
    const pages = createPagesCollection({ layoutBlocks: [block('cta'), block('formBlock')] })

    expect(layoutField(pages.fields).blocks.map((b) => b.slug)).toEqual(['cta', 'formBlock'])
  })

  it('shows drafts to staff only, like every content collection', () => {
    expect(createPagesCollection({ layoutBlocks: [] }).access).toBe(draftContentAccess)
  })

  it('sets the publish date and refreshes the page and the sitemap when saved or deleted', () => {
    const { hooks } = createPagesCollection({ layoutBlocks: [] })

    expect(hooks?.beforeChange).toEqual([populatePublishedAt])
    expect(hooks?.afterChange).toEqual([revalidatePage])
    expect(hooks?.afterDelete).toEqual([revalidateDelete])
  })

  // The page draws it faded behind its content (#777); it is never required, so a page without one is unchanged
  it('offers an optional backdrop photo from the media library, in the sidebar', () => {
    const { fields } = createPagesCollection({ layoutBlocks: [] })
    const backdrop = fields.find((field) => 'name' in field && field.name === 'backdrop')

    expect(backdrop).toMatchObject({
      type: 'upload',
      relationTo: 'media',
      admin: { position: 'sidebar' },
    })
    expect(backdrop && 'required' in backdrop && backdrop.required).toBeFalsy()
  })

  // A video would loop behind the page as motion, and a PDF can't be drawn as a photo
  it('takes pictures only, not the videos and PDFs the media library also holds', () => {
    const { fields } = createPagesCollection({ layoutBlocks: [] })
    const backdrop = fields.find((field) => 'name' in field && field.name === 'backdrop')

    expect(backdrop).toMatchObject({ filterOptions: { mimeType: { contains: 'image/' } } })
  })

  it('previews a page at its address on the site', () => {
    vi.stubEnv('PREVIEW_SECRET', 'shh')
    const { admin } = createPagesCollection({ layoutBlocks: [] })
    const preview = admin?.preview?.(
      { slug: 'about' },
      { locale: 'en', req: {} as PayloadRequest, token: null },
    )

    expect(preview).toBe(
      '/next/preview?slug=about&collection=pages&path=%2Fabout&previewSecret=shh',
    )
  })
})

describe('SITE_LAYOUT_BLOCKS', () => {
  it('lists the site’s own page-builder blocks in the order editors see them', () => {
    expect(SITE_LAYOUT_BLOCKS.map((b) => b.slug)).toEqual([
      'cta',
      'content',
      'section',
      'mediaBlock',
      'mapBlock',
      'archive',
    ])
  })
})
