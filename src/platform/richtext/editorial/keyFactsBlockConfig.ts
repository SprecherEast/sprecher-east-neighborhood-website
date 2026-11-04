import type { Block, Field } from 'payload'

import { CERTAINTY_OPTIONS } from '@/platform/lib/certainty'

import { FACT_ICON_OPTIONS } from './factIcons'
import { editorialLinkFields } from './linkFields'

/**
 * The fields of one fact (#660, #674), in the order the card reads: what it is about (the label),
 * where it stands (the value), an optional one-line explanation, an icon, how sure we are and an
 * optional link. One definition, so the key facts block and any later block that draws a fact
 * (the fact tabs) store it the same way.
 */
export const keyFactFields = (): Field[] => [
  {
    type: 'row',
    fields: [
      {
        name: 'label',
        type: 'text',
        required: true,
        maxLength: 60,
        admin: { width: '50%', description: 'What it is about: "Who pays for the ramps".' },
      },
      {
        name: 'value',
        type: 'text',
        required: true,
        maxLength: 24,
        admin: {
          width: '50%',
          description: 'Where it stands, or the number: "Pending", "2040s", "$10M".',
        },
      },
    ],
  },
  {
    name: 'detail',
    type: 'text',
    maxLength: 90,
    admin: {
      description: 'Optional. One plain sentence on why: "City and State are still negotiating."',
    },
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
 * The facts a reader wants first (#509): an icon with what each is about, a short value, a line
 * of explanation, how sure we are and where it comes from. It follows the USWDS icon list and
 * summary box: a few scannable facts, each labelled, never a value on its own.
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
