import type { Field } from 'payload'
import { array, number, select, text } from 'payload/shared'

import { CHART_LIMITS } from '@/platform/lib/chart/spec'

import { checked } from './chartValidate'

/** Shown only when the block's `kind` is one of these */
const forKinds =
  (...kinds: string[]) =>
  (_data: unknown, sibling: { kind?: string | null }) =>
    kinds.includes(sibling?.kind ?? '')

/** The name of a part, bar, group or row */
const labelField = (width: string): Field => ({
  name: 'label',
  type: 'text',
  required: true,
  maxLength: CHART_LIMITS.label,
  admin: { width },
})

/** A part's optional name and its hatch: the key links the same part in two groups' legends */
const keyField = (): Field => ({
  name: 'key',
  type: 'text',
  maxLength: CHART_LIMITS.key,
  admin: {
    width: '40%',
    description:
      'Optional. Leave empty to use the label. Parts with the same key share a colour key.',
  },
})

const hatchField = (): Field => ({
  name: 'hatch',
  type: 'checkbox',
  label: 'Striped',
  admin: { width: '20%', description: 'Stripes mark an amount that is only proposed.' },
})

/** One part of a bar chart or a grid: its name, number and stripes. */
const partFields = (): Field[] => [
  {
    type: 'row',
    fields: [
      labelField('40%'),
      {
        name: 'value',
        type: 'number',
        required: true,
        min: 0,
        admin: { width: '40%', description: 'In the unit above. Never negative.' },
      },
    ],
  },
  { type: 'row', fields: [keyField(), hatchField()] },
]

const scaleMaxField = (): Field => ({
  name: 'scaleMax',
  type: 'number',
  min: 0,
  admin: {
    condition: forKinds('bar', 'stacked'),
    description:
      'Optional. The end of the scale. Charts with the same scale draw the same number the same length.',
  },
  validate: checked('scaleMax', number),
})

const barFields = (): Field[] => [
  {
    name: 'bars',
    type: 'array',
    labels: { singular: 'Bar', plural: 'Bars' },
    minRows: 1,
    maxRows: CHART_LIMITS.rows,
    required: true,
    admin: { condition: forKinds('bar'), description: 'One to twelve bars, top to bottom.' },
    validate: checked('bars', array),
    fields: partFields(),
  },
]

const stackedFields = (): Field[] => [
  {
    name: 'series',
    type: 'array',
    labels: { singular: 'Part', plural: 'Parts' },
    minRows: 1,
    maxRows: CHART_LIMITS.parts,
    required: true,
    admin: {
      condition: forKinds('stacked'),
      description: 'The parts each bar splits into, such as “Borrowed” and “Other sources”.',
    },
    validate: checked('series', array),
    fields: [
      { type: 'row', fields: [labelField('60%'), keyField()] },
      {
        type: 'row',
        fields: [
          hatchField(),
          {
            name: 'increase',
            type: 'checkbox',
            label: 'An increase',
            admin: {
              width: '40%',
              description: 'Added on top of the first part: shown as “+$24.8M”.',
            },
          },
        ],
      },
    ],
  },
  {
    name: 'rows',
    type: 'array',
    labels: { singular: 'Bar', plural: 'Bars' },
    minRows: 1,
    maxRows: CHART_LIMITS.rows,
    required: true,
    admin: {
      condition: forKinds('stacked'),
      description: 'One bar per row. Give each a number for every part above, in the same order.',
    },
    validate: checked('rows', array),
    fields: [
      {
        type: 'row',
        fields: [
          labelField('40%'),
          {
            name: 'note',
            type: 'text',
            maxLength: CHART_LIMITS.rowNote,
            admin: {
              width: '60%',
              description: 'Optional note beside the bar. Give every bar one, or none.',
            },
          },
        ],
      },
      {
        name: 'values',
        type: 'array',
        labels: { singular: 'Number', plural: 'Numbers' },
        minRows: 1,
        maxRows: CHART_LIMITS.parts,
        admin: { description: 'One number for each part, in the order of the parts.' },
        fields: [{ name: 'value', type: 'number', required: true, min: 0 }],
      },
    ],
  },
]

const unitsFields = (): Field[] => [
  {
    type: 'row',
    fields: [
      {
        name: 'mode',
        type: 'select',
        required: true,
        defaultValue: 'perHundred',
        options: [
          { label: 'Of every $100: 100 squares share out the dollars', value: 'perHundred' },
          { label: 'Each: one tile per part', value: 'each' },
        ],
        admin: { width: '60%', condition: forKinds('units') },
        validate: checked('mode', select),
      },
    ],
  },
  {
    name: 'unitNote',
    type: 'textarea',
    required: true,
    maxLength: CHART_LIMITS.unitNote,
    admin: {
      condition: forKinds('units'),
      description: 'What one square or tile stands for, in a sentence.',
    },
    validate: checked('unitNote', (value, args) =>
      text(value as string | null | undefined, args as never),
    ),
  },
  {
    name: 'groups',
    type: 'array',
    labels: { singular: 'Group', plural: 'Groups' },
    minRows: 1,
    maxRows: CHART_LIMITS.groups,
    required: true,
    admin: {
      condition: forKinds('units'),
      description:
        'One grid for each group; two put them side by side, such as 2026 next to 2027. A grid shows at most six parts; a row of tiles up to twelve.',
    },
    validate: checked('groups', array),
    fields: [
      {
        type: 'row',
        fields: [
          labelField('40%'),
          {
            name: 'total',
            type: 'number',
            min: 0,
            admin: { width: '30%', description: 'Optional: the whole the parts add up to.' },
          },
        ],
      },
      { type: 'row', fields: [keyField()] },
      {
        name: 'parts',
        type: 'array',
        labels: { singular: 'Part', plural: 'Parts' },
        minRows: 1,
        maxRows: CHART_LIMITS.rows,
        required: true,
        fields: partFields(),
      },
    ],
  },
]

/** The fields of each kind, shown only for that kind, then the scale shared by the bar kinds */
export const chartDataFields = (): Field[] => [
  ...unitsFields(),
  ...barFields(),
  ...stackedFields(),
  scaleMaxField(),
]
