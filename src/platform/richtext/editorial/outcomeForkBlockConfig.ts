import type { Block } from 'payload'

import { OUTCOME_TONE_OPTIONS } from './outcomeTone'

/** The block's type, which the page also reads to tell a row of cards from text */
export const OUTCOME_FORK_BLOCK_TYPE = 'outcomeFork'

/**
 * One open question and the two or three ways it can go (#510): the question on top, lines
 * branching to an outcome card each. A one-level decision tree, for stories that hinge on one
 * decision ("Will the City and State agree on cost?").
 */
export const OutcomeForkBlockConfig: Block = {
  slug: OUTCOME_FORK_BLOCK_TYPE,
  interfaceName: 'OutcomeForkBlock',
  labels: { singular: 'Outcome fork', plural: 'Outcome forks' },
  fields: [
    {
      name: 'question',
      type: 'text',
      required: true,
      maxLength: 140,
      admin: { description: 'The open question, as a reader would ask it.' },
    },
    {
      name: 'outcomes',
      type: 'array',
      labels: { singular: 'Outcome', plural: 'Outcomes' },
      admin: { description: 'Two or three possible answers, each with what it would mean.' },
      minRows: 2,
      maxRows: 3,
      required: true,
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'title',
              type: 'text',
              required: true,
              maxLength: 60,
              admin: { width: '50%', description: 'The answer: "If they agree".' },
            },
            {
              name: 'tone',
              type: 'select',
              required: true,
              defaultValue: 'open',
              options: OUTCOME_TONE_OPTIONS,
              admin: { width: '50%' },
            },
          ],
        },
        {
          name: 'description',
          type: 'textarea',
          required: true,
          maxLength: 300,
          admin: { description: 'What happens then, in one or two plain sentences.' },
        },
      ],
    },
  ],
}
