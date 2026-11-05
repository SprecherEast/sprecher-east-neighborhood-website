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

/**
 * A post of repeating cards with the content most likely to knock them out of line (#678): one
 * title that wraps beside titles that don't, a missing explanation, a source link that wraps, and
 * a title at the editor's longest. The alignment test measures it at six widths.
 */
export const alignmentPost = (): RequiredDataFromCollectionSlug<'posts'> => ({
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
  ]),
})
