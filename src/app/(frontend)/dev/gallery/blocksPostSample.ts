import { heading, p, root } from '@/endpoints/seed/helpers/lexical'
import type { RichTextValue } from '@/platform/lib'
import { FIXTURES } from '@/platform/lib/chart/fixtures'
import { parseChartSpec } from '@/platform/lib/chart/spec'
import { fromChartSpec } from '@/platform/richtext/editorial/chart'

/*
 * A post's body as the editor stores it (#640): the visual blocks in a row, with a chart of each
 * kind between them, so one page shows that a new block never breaks the others. The charts are
 * the City's published budget figures (`FIXTURES`), stored the way the Chart block stores them.
 */

/** A block node as Lexical stores one */
const block = (fields: Record<string, unknown>) => ({
  type: 'block',
  version: 2,
  format: '',
  fields: {
    id: `sample-${fields.blockType}-${String(fields.title ?? fields.question ?? '')}`,
    ...fields,
  },
})
const chart = (name: keyof typeof FIXTURES) =>
  block({ blockType: 'chart', ...fromChartSpec(parseChartSpec(FIXTURES[name])) })

// The seed's Lexical helpers type nodes loosely, so the result is asserted to the renderer's type
export const SAMPLE_BLOCKS_POST = root([
  heading('h2', 'What the 2027 budget means for the neighborhood'),
  p('A post can mix its visual blocks with plain paragraphs. Each one stands on its own.'),
  block({
    blockType: 'keyFacts',
    facts: [
      {
        value: '$477.5M',
        label: 'Proposed day-to-day budget',
        detail: 'What the City would spend on services in 2027.',
        icon: 'money',
        certainty: 'confirmed',
      },
      { value: '+$24.8M', label: 'More than in 2026', icon: 'taxes', certainty: 'estimate' },
    ],
  }),
  heading('h3', 'Where each $100 goes'),
  chart('paysFor'),
  p('The same money, a bar for each year.'),
  chart('bars'),
  heading('h3', 'How the big projects are paid for'),
  chart('borrowed'),
  block({
    blockType: 'timeline',
    entries: [
      { date: 'Oct 2026', status: 'done', title: 'The Mayor proposes the budget' },
      { date: 'Nov 2026', status: 'next', title: 'The Council votes' },
      { date: 'Jan 2027', status: 'later', title: 'The new budget starts' },
    ],
  }),
  block({
    blockType: 'steps',
    steps: [{ heading: 'Read the proposal' }, { heading: 'Tell your alder' }],
  }),
  block({
    blockType: 'outcomeFork',
    question: 'Will the Council change it?',
    outcomes: [
      {
        title: 'If it passes as proposed',
        tone: 'go',
        description: 'The numbers above are the budget.',
      },
      {
        title: 'If it is amended',
        tone: 'open',
        description: 'Some figures change; this page is updated.',
      },
    ],
  }),
  chart('comesIn'),
]) as unknown as RichTextValue
