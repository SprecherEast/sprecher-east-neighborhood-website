import type { Block, Field } from 'payload'

import { CERTAINTY_OPTIONS } from '@/platform/lib/certainty'

import { KEY_FACT_LIMITS, KEY_FACTS_LIMITS } from './editorialLimits'
import { FACT_ICON_OPTIONS } from './factIcons'
import { filledText } from './filledText'
import { editorialLinkFields } from './linkFields'
import { rowsBetween } from './rowCount'

const valueFilled = filledText('Add the big text: where it stands, or the number.')
const labelFilled = filledText('Add what the fact is about, as a short title.')

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
        maxLength: KEY_FACT_LIMITS.label,
        validate: labelFilled,
        admin: {
          width: '50%',
          description: 'What it is about, as a short title: "Who pays for the ramps".',
        },
      },
      {
        name: 'value',
        type: 'text',
        required: true,
        maxLength: KEY_FACT_LIMITS.value,
        validate: valueFilled,
        admin: {
          width: '50%',
          description: 'The big text: where it stands, or the number. "Pending", "2040s", "$10M".',
        },
      },
    ],
  },
  {
    name: 'detail',
    type: 'text',
    maxLength: KEY_FACT_LIMITS.detail,
    admin: {
      description:
        'Optional. One plain sentence that explains it: "City and State are still negotiating."',
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

/** The block's type, which the page also reads to tell a row of cards from text */
export const KEY_FACTS_BLOCK_TYPE = 'keyFacts'

/**
 * The facts a reader wants first (#509): an icon with what each is about, a short value, a line
 * of explanation, how sure we are and where it comes from. It follows the USWDS icon list and
 * summary box: a few scannable facts, each labelled, never a value on its own.
 */
export const KeyFactsBlockConfig: Block = {
  slug: KEY_FACTS_BLOCK_TYPE,
  interfaceName: 'KeyFactsBlock',
  labels: { singular: 'Key facts', plural: 'Key facts' },
  fields: [
    {
      name: 'facts',
      type: 'array',
      labels: { singular: 'Fact', plural: 'Facts' },
      admin: {
        description: `${KEY_FACTS_LIMITS.minFacts} to ${KEY_FACTS_LIMITS.maxFacts} facts. They sit side by side on wide screens.`,
      },
      minRows: KEY_FACTS_LIMITS.minFacts,
      maxRows: KEY_FACTS_LIMITS.maxFacts,
      required: true,
      validate: rowsBetween(KEY_FACTS_LIMITS.minFacts, KEY_FACTS_LIMITS.maxFacts, 'facts'),
      fields: keyFactFields(),
    },
  ],
}
