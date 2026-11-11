import type { RequiredDataFromCollectionSlug } from 'payload'

import { block, heading, p, root } from '../../src/endpoints/seed/helpers/lexical'
import { FACT_TABS_FIXTURE } from '../../src/platform/richtext/editorial/factTabsFixtures'
import {
  LONGEST_FACT,
  NO_DETAIL_FACT,
  SHORT_FACT,
  UNEVEN_FACTS,
  WRAPPING_FACT,
} from '../../src/platform/richtext/editorial/keyFactsFixtures'
import { ALIGNMENT_POST_SLUG } from './alignmentSlug'

/** The caption the figure test measures: long enough to run to two lines on a phone (#658) */
export const FIGURE_CAPTION =
  'A sample figure with a caption that runs to more than one line on a phone.'

/**
 * A post of repeating cards with the content most likely to knock them out of line (#678): one
 * title that wraps beside titles that don't, a missing explanation, a source link that wraps, and
 * a title at the editor's longest. The alignment test measures it at six widths. It ends with an
 * image that has a caption, and the legend under it (#658).
 */
export const alignmentPost = (
  mediaId: number,
  authorId: number,
): RequiredDataFromCollectionSlug<'posts'> => ({
  // One author with a long name: the metadata bar cuts it to one line (#1055)
  authors: [authorId],
  slug: ALIGNMENT_POST_SLUG,
  title: 'Alignment check',
  _status: 'published',
  publishedAt: new Date().toISOString(),
  content: root([
    heading('h2', 'Three facts, one title wraps'),
    block('alignment-1', { blockType: 'keyFacts', facts: UNEVEN_FACTS }),
    heading('h2', 'Two facts, the longest title'),
    block('alignment-2', { blockType: 'keyFacts', facts: [LONGEST_FACT, NO_DETAIL_FACT] }),
    heading('h2', 'Six facts'),
    block('alignment-3', {
      blockType: 'keyFacts',
      facts: [SHORT_FACT, WRAPPING_FACT, NO_DETAIL_FACT, LONGEST_FACT, SHORT_FACT, WRAPPING_FACT],
    }),
    heading('h2', 'Four fact tabs'),
    p('Each tab is a fact; the tab buttons are a row of cards too.'),
    block('alignment-4', { blockType: 'factTabs', ...FACT_TABS_FIXTURE }),
    heading('h2', 'An image with a caption and a legend'),
    block('alignment-5', { blockType: 'mediaBlock', media: mediaId }),
    block('alignment-6', {
      blockType: 'diagramKey',
      items: [
        { label: 'North roundabout', text: 'Ramps meet the crossing road.' },
        { label: 'Westbound loop', text: null },
        { label: 'South roundabout', text: 'The matching junction on the other side of I-94.' },
      ],
    }),
  ]),
})
