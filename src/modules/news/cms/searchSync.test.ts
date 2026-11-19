import type { DocToSync } from '@payloadcms/plugin-search/types'
import type { PayloadRequest } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { beforeSyncWithSearch } from './searchSync'

const req = {
  payload: { findByID: vi.fn(), logger: { error: vi.fn() } },
} as unknown as PayloadRequest

/** Runs the sync the way the search plugin does when a post or an event is saved. */
const sync = (relationTo: 'posts' | 'events', originalDoc: Record<string, unknown>) =>
  beforeSyncWithSearch({
    collectionSlug: relationTo,
    payload: req.payload,
    req,
    originalDoc: { id: 3, slug: 'council', title: 'Council', ...originalDoc },
    searchDoc: { doc: { relationTo, value: '3' }, title: 'Council' } as DocToSync,
  })

describe('beforeSyncWithSearch', () => {
  it('copies whether an event is cancelled, so search results can say so (#471)', async () => {
    expect(await sync('events', { cancelled: true })).toMatchObject({ cancelled: true })
    expect(await sync('events', { cancelled: false })).toMatchObject({ cancelled: false })
  })

  it('stores posts, which have no such flag, as not cancelled', async () => {
    expect(await sync('posts', {})).toMatchObject({ cancelled: false })
  })

  it('copies the source a post or event names (#492)', async () => {
    const source = { sourceName: 'WisDOT', sourceUrl: 'https://wisconsindot.gov/' }

    expect(await sync('posts', source)).toMatchObject(source)
    expect(await sync('events', {})).toMatchObject({ sourceName: null, sourceUrl: null })
  })

  it('keeps the slug and the search-engine fields, as before', async () => {
    expect(
      await sync('posts', { meta: { title: '', description: 'Agenda', image: { id: 4 } } }),
    ).toMatchObject({
      slug: 'council',
      meta: { title: 'Council', description: 'Agenda', image: 4 },
      categories: [],
    })
  })
})
