import type { RequiredDataFromCollectionSlug } from 'payload'

import { heading, p, root } from '../../src/endpoints/seed/helpers/lexical'

// The slugs the backdrop test opens (#1268): a post, an event and a page with a photo behind them,
// and a post without one
export const BACKDROP_POST_SLUG = 'backdrop-post-check'
export const BACKDROP_EVENT_SLUG = 'backdrop-event-check'
export const BACKDROP_PAGE_SLUG = 'backdrop-page-check'
export const PLAIN_POST_SLUG = 'backdrop-plain-post-check'

const paragraphs = (count: number) =>
  Array.from({ length: count }, (_, index) =>
    p(
      `Paragraph ${index + 1}. The text of the article runs down the column, line after line, long enough that the page is taller than the screen and the photo behind it has room to drift.`,
    ),
  )

const content = root([heading('h2', 'What we are building'), ...paragraphs(12)])

/** The three crops of one photo, which every size of the backdrop shows */
const crops = (mediaId: number) => ({ phone: mediaId, tablet: mediaId, desktop: mediaId })

export const backdropPost = (mediaId: number): RequiredDataFromCollectionSlug<'posts'> => ({
  slug: BACKDROP_POST_SLUG,
  title: 'Sprecher East Is Coming Together',
  _status: 'published',
  publishedAt: new Date().toISOString(),
  backdrop: crops(mediaId),
  content,
})

export const plainPost = (): RequiredDataFromCollectionSlug<'posts'> => ({
  slug: PLAIN_POST_SLUG,
  title: 'A post with no photo behind it',
  _status: 'published',
  publishedAt: new Date().toISOString(),
  content,
})

export const backdropEvent = (mediaId: number): RequiredDataFromCollectionSlug<'events'> => ({
  slug: BACKDROP_EVENT_SLUG,
  title: 'Neighborhood walk and talk',
  _status: 'published',
  date: '2030-01-15T00:00:00.000Z',
  timeStart: '6:30 PM',
  locationName: 'The community room',
  backdrop: crops(mediaId),
  content,
})

/** A page with a low-impact title, a text block and a photo behind the whole page */
export const backdropPage = (mediaId: number): RequiredDataFromCollectionSlug<'pages'> => ({
  slug: BACKDROP_PAGE_SLUG,
  title: 'A page with a photo behind it',
  _status: 'published',
  backdrop: mediaId,
  hero: { type: 'lowImpact', richText: root([heading('h1', 'A page with a photo behind it')]) },
  layout: [
    {
      blockName: 'Text',
      blockType: 'content',
      columns: [{ richText: content, size: 'full' }],
    },
  ],
})
