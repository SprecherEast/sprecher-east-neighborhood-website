import type { Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { TITLE_MAX_LENGTH } from '@/platform/lib'
import { bootPayload, NO_REVALIDATE } from '@/platform/payload/testing/inMemoryPayload'

/**
 * The title limit (#633): posts, events and pages take their title from the one `titleField()`,
 * so each stops at `TITLE_MAX_LENGTH` and no editor can save a title too long for the breadcrumb
 * trail. Payload runs on an in-memory SQLite database: no file, no network.
 */

let payload: Payload

beforeAll(async () => {
  ;({ payload } = await bootPayload())
}, 60_000)

const paragraph = (text: string) => ({
  root: {
    type: 'root',
    version: 1,
    direction: 'ltr' as const,
    format: '' as const,
    indent: 0,
    children: [
      {
        type: 'paragraph',
        version: 1,
        direction: 'ltr' as const,
        format: '' as const,
        indent: 0,
        children: [{ type: 'text', version: 1, text, format: 0, detail: 0, mode: 'normal' }],
      },
    ],
  },
})

const createPost = (title: string, status: 'draft' | 'published' = 'draft') =>
  payload.create({
    collection: 'posts',
    data: {
      title,
      slug: `${status}-${title.length}`,
      content: paragraph('Body.'),
      _status: status,
    },
    draft: status === 'draft',
    context: NO_REVALIDATE,
    overrideAccess: true,
  })

describe('the title limit', () => {
  it.each(['posts', 'events', 'pages'] as const)(
    'applies to %s through the shared field',
    (slug) => {
      const title = payload.collections[slug].config.fields.find(
        (field) => 'name' in field && field.name === 'title',
      )

      expect(title).toMatchObject({ type: 'text', maxLength: TITLE_MAX_LENGTH })
    },
  )

  it('saves a title of exactly the limit', async () => {
    const post = await createPost('x'.repeat(TITLE_MAX_LENGTH))

    expect(post.title).toHaveLength(TITLE_MAX_LENGTH)
  })

  // Payload checks a field's limits when a document is published, not on every draft autosave
  it('refuses to publish a title one character over the limit', async () => {
    await expect(createPost('x'.repeat(TITLE_MAX_LENGTH + 1), 'published')).rejects.toMatchObject({
      name: 'ValidationError',
      data: { errors: [{ path: 'title' }] },
    })
  })

  it('still saves a draft with a long title, so an editor can shorten it later', async () => {
    const post = await createPost('x'.repeat(TITLE_MAX_LENGTH + 1))

    expect(post._status).toBe('draft')
  })
})
