import type { Payload } from 'payload'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { TITLE_MAX_LENGTH } from '@/platform/lib'

/**
 * The title limit (#633): posts, events and pages take their title from the one `titleField()`,
 * so each stops at `TITLE_MAX_LENGTH` and no editor can save a title too long for the breadcrumb
 * trail. Payload runs on an in-memory SQLite database: no file, no network.
 */

// The posts' revalidation hook needs a Next.js request, which a test doesn't have
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

let payload: Payload

beforeAll(async () => {
  vi.stubEnv('DATABASE_URI', 'file::memory:')
  vi.stubEnv('PAYLOAD_SECRET', 'title-limit-test-secret-0123456789abcdef')
  vi.stubEnv('SMTP_HOST', '')
  const { getPayload } = await import('payload')
  const config = await (await import('@payload-config')).default
  payload = await getPayload({ config })
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
    await expect(createPost('x'.repeat(TITLE_MAX_LENGTH + 1), 'published')).rejects.toThrow(
      /title/i,
    )
  })

  it('still saves a draft with a long title, so an editor can shorten it later', async () => {
    const post = await createPost('x'.repeat(TITLE_MAX_LENGTH + 1))

    expect(post._status).toBe('draft')
  })
})
