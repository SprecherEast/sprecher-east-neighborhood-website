import { block, heading, p, root } from '@/endpoints/seed/helpers/lexical'
import type { RichTextValue } from '@/platform/lib'

/*
 * An article split into section tabs (#1333), as the editor stores it: an introduction above the
 * block, then tabs whose content is ordinary article text and blocks. Placeholder wording; the
 * dates are made up to read the layout with.
 */

/** One tab's content: rich text of its own, as the block stores it */
const panel = (...children: unknown[]) => root(children as never)

export const SAMPLE_SECTION_TABS_POST = root([
  p(
    'An introduction sits above the tabs, with its picture beside it, so the tabs start below both.',
  ),
  block('sample-section-tabs', {
    blockType: 'sectionTabs',
    tabs: [
      {
        label: 'Overview',
        panel: panel(
          heading('h3', 'The short version'),
          p('Each tab holds ordinary article text: paragraphs, headings and the article’s blocks.'),
          block('sample-section-tabs-facts', {
            blockType: 'keyFacts',
            facts: [
              {
                value: 'Proposed',
                label: 'Where it stands',
                icon: 'government',
                certainty: 'estimate',
              },
              {
                value: 'Nov 10',
                label: 'Next public meeting',
                icon: 'calendar',
                certainty: 'confirmed',
              },
            ],
          }),
        ),
      },
      {
        label: 'Timeline',
        panel: panel(
          heading('h3', 'Where things stand'),
          block('sample-section-tabs-timeline', {
            blockType: 'timeline',
            entries: [
              { date: 'Oct 2026', status: 'done', title: 'The plan is proposed' },
              { date: 'Nov 2026', status: 'next', title: 'A public meeting' },
              { date: 'Later', status: 'later', title: 'A decision' },
            ],
          }),
        ),
      },
      {
        label: 'What to do',
        panel: panel(
          heading('h3', 'How to have a say'),
          block('sample-section-tabs-steps', {
            blockType: 'steps',
            steps: [{ heading: 'Read the proposal' }, { heading: 'Tell your alder' }],
          }),
        ),
      },
    ],
  }),
  p('What follows the tabs starts below them, in the same column.'),
]) as unknown as RichTextValue
