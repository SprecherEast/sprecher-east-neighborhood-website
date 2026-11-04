import type { Block, Field } from 'payload'

import { CERTAINTY_OPTIONS } from '@/platform/lib/certainty'

import { KEY_FACT_LIMITS } from './editorialLimits'
import { FACT_ICON_OPTIONS } from './factIcons'
import { editorialLinkFields } from './linkFields'

/**
 * The fields of one fact (#660): a value, a label, an icon, how sure we are and an optional
 * link. One definition, so the key facts block and any later block that draws a fact (the fact
 * tabs) store it the same way.
 */
export const keyFactFields = (): Field[] => [
  {
    type: 'row',
    fields: [
      {
        name: 'value',
        type: 'text',
        required: true,
        maxLength: KEY_FACT_LIMITS.value,
        admin: { width: '50%', description: 'Short: "2040s", "$10M", "Not set".' },
      },
      {
        name: 'label',
        type: 'text',
        required: true,
        maxLength: KEY_FACT_LIMITS.label,
        admin: { width: '50%', description: 'What it is: "earliest construction".' },
      },
    ],
  },
  {
    type: 'row',
    fields: [
      {
        name: 'icon',
        type: 'select',
        required: true,
        defaultValue: 'info',
        options: FACT_ICON_OPTIONS,
        admin: { width: '50%' },
      },
      {
        name: 'certainty',
        type: 'select',
        required: true,
        defaultValue: 'confirmed',
        options: CERTAINTY_OPTIONS,
        admin: { width: '50%' },
      },
    ],
  },
  editorialLinkFields({ labelExample: 'City budget' }),
]

/**
 * The numbers a reader wants first (#509): an icon, a short value, what it is, how sure we are
 * and where it comes from. It follows the USWDS icon list and summary box: a few scannable facts,
 * each labelled, never a value on its own.
 */
export const KeyFactsBlockConfig: Block = {
  slug: 'keyFacts',
  interfaceName: 'KeyFactsBlock',
  labels: { singular: 'Key facts', plural: 'Key facts' },
  fields: [
    {
      name: 'facts',
      type: 'array',
      labels: { singular: 'Fact', plural: 'Facts' },
      admin: { description: 'Two to six facts. They sit side by side on wide screens.' },
      minRows: 2,
      maxRows: 6,
      required: true,
      fields: keyFactFields(),
    },
  ],
}
