import type { Field } from 'payload'
import { array, select, text } from 'payload/shared'

import { CERTAINTY_OPTIONS } from '@/platform/lib/certainty'
import { CHART_LIMITS, type CHART_KINDS, type CHART_UNITS } from '@/platform/lib/chart/spec'

import { checked } from './chartValidate'
import { editorialLinkFields } from './linkFields'

/** What an editor calls each kind of chart */
const KIND_OPTIONS = [
  {
    label: 'Grid of squares or tiles: how 100 dollars are shared out, or one tile per part',
    value: 'units',
  },
  { label: 'Bars: one bar for each number', value: 'bar' },
  {
    label: 'Stacked bars: bars that split into parts, such as 2026 next to 2027',
    value: 'stacked',
  },
] satisfies { label: string; value: (typeof CHART_KINDS)[number] }[]

const UNIT_OPTIONS = [
  { label: 'Dollars ($)', value: 'usd' },
  { label: 'Percent (%)', value: 'percent' },
  { label: 'Mills (tax per $1,000 of value)', value: 'mills' },
  { label: 'A count (people, homes, items)', value: 'count' },
] satisfies { label: string; value: (typeof CHART_UNITS)[number] }[]

/**
 * The fields every kind of chart has, first in the block: what it is called, the takeaway in
 * words, the kind, the unit, when the figures are from, how sure we are, and where they come
 * from. The takeaway is required: a chart is never the only way to learn what it shows.
 */
export const chartBaseFields = (): Field[] => [
  {
    name: 'title',
    type: 'text',
    required: true,
    maxLength: CHART_LIMITS.title,
    admin: { description: 'What the chart shows: "Where each $100 goes".' },
    validate: checked('title', text),
  },
  {
    name: 'summary',
    type: 'textarea',
    required: true,
    maxLength: CHART_LIMITS.summary,
    admin: {
      description:
        'The takeaway, in a sentence or two. It sits beside the small chart and is what screen readers hear first. Inside a Fact tab, keep it to one line.',
    },
    validate: checked('summary', (value, args) =>
      text(value as string | null | undefined, args as never),
    ),
  },
  {
    type: 'row',
    fields: [
      {
        name: 'kind',
        type: 'select',
        required: true,
        defaultValue: 'bar',
        options: KIND_OPTIONS,
        admin: { width: '70%' },
        validate: checked('kind', select),
      },
      {
        name: 'unit',
        type: 'select',
        required: true,
        defaultValue: 'usd',
        options: UNIT_OPTIONS,
        admin: { width: '30%', description: 'What the numbers count.' },
        validate: checked('unit', select),
      },
    ],
  },
  {
    type: 'row',
    fields: [
      {
        name: 'asOf',
        type: 'text',
        label: 'As of',
        maxLength: CHART_LIMITS.asOf,
        admin: {
          width: '50%',
          description: 'When the figures are from: "Mayor’s proposal, October 2026".',
        },
        validate: checked('asOf', text),
      },
      {
        name: 'certainty',
        type: 'select',
        options: CERTAINTY_OPTIONS,
        admin: { width: '50%', description: 'Leave empty to show no label.' },
        validate: checked('certainty', select),
      },
    ],
  },
  {
    name: 'finePrint',
    type: 'textarea',
    maxLength: CHART_LIMITS.finePrint,
    admin: { description: 'Optional small print under the chart: what was rounded or calculated.' },
    validate: checked('finePrint', (value, args) =>
      text(value as string | null | undefined, args as never),
    ),
  },
  {
    name: 'sources',
    type: 'array',
    labels: { singular: 'Source', plural: 'Sources' },
    maxRows: CHART_LIMITS.sources,
    admin: { description: 'Where the numbers come from. Up to four.' },
    validate: checked('sources', array),
    fields: [
      editorialLinkFields({
        labelExample: 'City of Madison, 2027 budget',
        labelMaxLength: CHART_LIMITS.sourceLabel,
        urlMaxLength: CHART_LIMITS.sourceHref,
      }),
    ],
  },
]
