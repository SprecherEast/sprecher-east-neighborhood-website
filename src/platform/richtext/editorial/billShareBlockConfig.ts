import type { Block, NumberField } from 'payload'

import { BILL_BODIES, BILL_BODY_NAMES, type BillBody } from '@/platform/lib/billShare'

import { BILL_SHARE_LIMITS } from './editorialLimits'
import { filledText } from './filledText'
import { editorialLinkFields } from './linkFields'
import { rowsBetween } from './rowCount'

/** A rate in dollars per $1,000 of assessed value; left empty until the body has set it */
const rateField = (key: BillBody): NumberField => ({
  name: key,
  type: 'number',
  label: BILL_BODY_NAMES[key],
  min: 0,
  max: 100,
  admin: { width: '25%', step: 0.0001 },
})

/**
 * The whole property-tax bill (#1018), shown at the top of a fact tab: a home value the reader can
 * change, the bill split among the four bodies as one proportional bar, and the rest of the tab
 * under the City's slice. One row per tax year with each body's net rate per $1,000 of value
 * (after the state school credit). A rate left empty means that body has not set it, and the
 * picture says so rather than guessing. The page draws it in `BillShare`.
 */
export const BillShareBlockConfig: Block = {
  slug: 'billShare',
  interfaceName: 'BillShareBlock',
  labels: { singular: 'Whole tax bill', plural: 'Whole tax bills' },
  fields: [
    {
      name: 'intro',
      type: 'text',
      required: true,
      maxLength: BILL_SHARE_LIMITS.intro,
      validate: filledText('Add the line that says what the bill is based on.'),
      admin: { description: 'One line above the home value box: what the estimate is based on.' },
    },
    {
      name: 'years',
      type: 'array',
      labels: { singular: 'Tax year', plural: 'Tax years' },
      admin: {
        description: `${BILL_SHARE_LIMITS.minYears} to ${BILL_SHARE_LIMITS.maxYears} tax years, oldest first. Readers switch between them. Use only rates the bodies have officially set.`,
      },
      minRows: BILL_SHARE_LIMITS.minYears,
      maxRows: BILL_SHARE_LIMITS.maxYears,
      required: true,
      validate: rowsBetween(BILL_SHARE_LIMITS.minYears, BILL_SHARE_LIMITS.maxYears, 'tax years'),
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'year',
              type: 'number',
              required: true,
              min: 2000,
              max: 2100,
              admin: { width: '25%', description: 'The budget year: 2027.' },
            },
            {
              name: 'label',
              type: 'text',
              required: true,
              maxLength: BILL_SHARE_LIMITS.label,
              validate: filledText('Add the name readers see on the switch.'),
              admin: {
                width: '50%',
                description: 'On the switch: "2026 rates (last year)".',
              },
            },
            {
              name: 'averageHome',
              type: 'number',
              required: true,
              min: 1,
              label: 'Average home value',
              admin: {
                width: '25%',
                description: 'The City’s average home that year, in dollars.',
              },
            },
          ],
        },
        {
          type: 'row',
          fields: BILL_BODIES.map(rateField),
        },
        editorialLinkFields({ labelExample: 'City tax detail' }),
      ],
    },
  ],
}
