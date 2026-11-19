import type { Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import type { RichTextValue } from '@/platform/lib'
import { richTextLinkHref } from '@/platform/richtext/RichText'
import { bootPayload, NO_REVALIDATE } from '@/platform/payload/testing/inMemoryPayload'

import type * as Queries from './queries'

/**
 * An internal link in an FAQ answer (a page or a post) reaches the FAQ page with its slug, so it
 * stays a link (#227). Payload runs on in-memory SQLite.
 */

type LinkFields = Parameters<typeof richTextLinkHref>[0]

let payload: Payload
let queries: typeof Queries

/** An answer that is one paragraph holding one internal link, as the editor saves it */
const answerLinking = (relationTo: 'pages' | 'posts', id: number): RichTextValue => ({
  root: {
    type: 'root',
    format: '',
    indent: 0,
    version: 1,
    direction: 'ltr',
    children: [
      {
        type: 'paragraph',
        textFormat: 0,
        version: 1,
        format: '',
        indent: 0,
        direction: 'ltr',
        children: [
          {
            type: 'link',
            version: 3,
            format: '',
            indent: 0,
            direction: 'ltr',
            fields: { linkType: 'internal', newTab: false, doc: { relationTo, value: id } },
            children: [
              { type: 'text', version: 1, text: 'the link', detail: 0, format: 0, mode: 'normal', style: '' },
            ],
          },
        ],
      },
    ],
  },
})

const faq = (question: string, answer: ReturnType<typeof answerLinking>) =>
  payload.create({
    collection: 'faq',
    data: { question, answer, _status: 'published' as const, order: 1 },
    overrideAccess: true,
    context: NO_REVALIDATE,
  })

/** Where the answer's one link goes, as the FAQ page renders it */
async function linkOf(question: string) {
  const entry = (await queries.findFaqEntries()).find((e) => e.question === question)
  const paragraph = entry?.answer.root.children[0] as { children: { fields: LinkFields }[] }
  return richTextLinkHref(paragraph.children[0].fields)
}

beforeAll(async () => {
  ;({ payload } = await bootPayload())
  queries = await import('./queries')

  const page = await payload.create({
    collection: 'pages',
    data: {
      title: 'About',
      slug: 'about',
      hero: { type: 'none' },
      layout: [{ blockType: 'cta' }],
      _status: 'published' as const,
    },
    overrideAccess: true,
    context: NO_REVALIDATE,
  })
  const post = await payload.create({
    collection: 'posts',
    data: {
      title: 'Welcome',
      slug: 'welcome',
      content: answerLinking('pages', page.id),
      publishedAt: '2026-10-01T12:00:00.000Z',
      _status: 'published' as const,
    },
    overrideAccess: true,
    context: NO_REVALIDATE,
  })
  const draft = await payload.create({
    collection: 'posts',
    data: {
      title: 'Not yet',
      slug: 'not-yet',
      content: answerLinking('pages', page.id),
      _status: 'draft' as const,
    },
    overrideAccess: true,
    context: NO_REVALIDATE,
  })

  await faq('Links a page', answerLinking('pages', page.id))
  await faq('Links a post', answerLinking('posts', post.id))
  await faq('Links a draft', answerLinking('posts', draft.id))
}, 60_000)

describe('internal links in FAQ answers (#227)', () => {
  it('keeps a link to a published page', async () => {
    expect(await linkOf('Links a page')).toBe('/about')
  })

  it('keeps a link to a published post', async () => {
    expect(await linkOf('Links a post')).toBe('/posts/welcome')
  })

  it('shows a link to a post the reader may not see as plain text, not as a link', async () => {
    expect(await linkOf('Links a draft')).toBeNull()
  })
})
