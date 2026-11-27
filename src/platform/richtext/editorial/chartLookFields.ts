import type { Field } from 'payload'
import { select, text } from 'payload/shared'

import { CHART_LIMITS } from '@/platform/lib/chart/spec'

import { forKinds } from './chartDataFields'
import { checked } from './chartValidate'

/*
 * The fields that pick a compact look of a chart (#1503): the compact rows of a bar chart and the
 * change-first look of a stacked chart. Each is left empty for the usual big bars.
 */

/** A bar's earlier amount, for the change column of the compact rows (#1503) */
export const previousField = (): Field => ({
  name: 'previous',
  type: 'number',
  min: 0,
  admin: {
    width: '40%',
    description:
      'Optional: what this was before, such as the 2026 amount. Shows its change in the compact rows.',
  },
})

/** The compact rows of a bar chart, and what its earlier amounts are */
export const barLookFields = (): Field[] => [
  {
    name: 'density',
    type: 'select',
    options: [
      { label: 'Big bars', value: 'full' },
      {
        label: 'Compact rows: a small bar, the figure and its change from the earlier amount',
        value: 'compact',
      },
    ],
    admin: {
      condition: forKinds('bar'),
      description: 'Leave empty for big bars.',
    },
    validate: checked('density', select),
  },
  {
    name: 'previousLabel',
    type: 'text',
    maxLength: CHART_LIMITS.label,
    admin: {
      condition: forKinds('bar'),
      description: 'What the earlier amounts are: "2026 adopted". Needed when a bar has one.',
    },
    validate: checked('previousLabel', text),
  },
]

/** The change-first look of a stacked chart */
export const stackedLookFields = (): Field[] => [
  {
    name: 'look',
    type: 'select',
    options: [
      { label: 'Big bars', value: 'bars' },
      {
        label:
          'Change first: the latest figure and how it changed, then a slim strip of the split (needs two bars)',
        value: 'change',
      },
    ],
    admin: {
      condition: forKinds('stacked'),
      description: 'Leave empty for big bars.',
    },
    validate: checked('look', select),
  },
]
