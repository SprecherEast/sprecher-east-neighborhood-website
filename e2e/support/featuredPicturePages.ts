import type { RequiredDataFromCollectionSlug } from 'payload'

import { block, heading, p, root } from '../../src/endpoints/seed/helpers/lexical'
import { SHORT_FACT, UNEVEN_FACTS } from '../../src/platform/richtext/editorial/keyFactsFixtures'

// The slugs the featured-picture test opens (#1023), apart from the pages that build them
export const PICTURE_POST_SLUG = 'picture-check'
export const PICTURE_CARDS_POST_SLUG = 'picture-cards-check'
export const PICTURE_EVENT_SLUG = 'picture-event-check'

const paragraphs = (count: number) =>
  Array.from({ length: count }, (_, index) =>
    p(
      `Paragraph ${index + 1}. The text of the article runs beside the picture and then under it, line after line, long enough to be taller than the picture beside it.`,
    ),
  )

/** A post with a picture and a long text, to measure the picture's width against the column */
export const picturePost = (mediaId: number): RequiredDataFromCollectionSlug<'posts'> => ({
  slug: PICTURE_POST_SLUG,
  title: 'Picture check',
  _status: 'published',
  publishedAt: new Date().toISOString(),
  heroImage: mediaId,
  content: root(paragraphs(10)),
})

/** A post with a picture that opens with a row of cards, which can't sit beside the picture */
export const pictureCardsPost = (mediaId: number): RequiredDataFromCollectionSlug<'posts'> => ({
  slug: PICTURE_CARDS_POST_SLUG,
  title: 'Picture and cards check',
  _status: 'published',
  publishedAt: new Date().toISOString(),
  heroImage: mediaId,
  content: root([
    heading('h2', 'Opening facts'),
    block('picture-cards-1', { blockType: 'keyFacts', facts: [SHORT_FACT, ...UNEVEN_FACTS] }),
    ...paragraphs(10),
  ]),
})

/** An event with a picture and a long text */
export const pictureEvent = (mediaId: number): RequiredDataFromCollectionSlug<'events'> => ({
  slug: PICTURE_EVENT_SLUG,
  title: 'Picture event check',
  _status: 'published',
  date: '2030-01-15T00:00:00.000Z',
  timeStart: '6:30 PM',
  locationName: 'The community room',
  heroImage: mediaId,
  content: root(paragraphs(10)),
})
