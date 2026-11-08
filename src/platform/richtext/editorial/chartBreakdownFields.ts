import type { Field } from 'payload'
import { array, number } from 'payload/shared'

import { CHART_LIMITS } from '@/platform/lib/chart/spec'

import { forKinds, keyField, labelField } from './chartDataFields'
import { checked } from './chartValidate'

/** A name and a dollar amount side by side: the first line of an area and of a piece */
const nameAndDollars = (): Field => ({
  type: 'row',
  fields: [
    labelField('40%'),
    {
      name: 'value',
      type: 'number',
      required: true,
      min: 0,
      admin: { width: '40%', description: 'In dollars.' },
    },
  ],
})

/** The fields of a breakdown chart (#866): what a square is worth, and the areas with their pieces */
export const chartBreakdownFields = (): Field[] => [
  {
    name: 'squareValue',
    type: 'number',
    min: 0,
    admin: {
      condition: forKinds('breakdown'),
      description:
        'What one square stands for, in dollars: 5000000 makes each square $5 million. Pick an amount that gives 20 to 200 squares.',
    },
    validate: checked('squareValue', number),
  },
  {
    name: 'areas',
    type: 'array',
    labels: { singular: 'Area', plural: 'Areas' },
    maxRows: CHART_LIMITS.areas,
    admin: {
      condition: forKinds('breakdown'),
      description:
        'The big areas of the budget, up to seven. They are ranked by size, and the colors run from the biggest to the smallest.',
    },
    validate: checked('areas', array),
    fields: [
      nameAndDollars(),
      { type: 'row', fields: [keyField()] },
      {
        name: 'pieces',
        type: 'array',
        labels: { singular: 'Piece', plural: 'Pieces' },
        maxRows: CHART_LIMITS.pieces,
        // See `groups`: an array inside a Lexical block needs an `admin` key
        admin: {
          description:
            'Optional smaller parts of this area. Pieces marked "Shown" sit under the area; the rest go in "See the smaller pieces".',
        },
        fields: [
          nameAndDollars(),
          {
            type: 'row',
            fields: [
              keyField(),
              {
                name: 'shown',
                type: 'checkbox',
                label: 'Shown',
                admin: { width: '20%', description: 'Show this piece right under its area.' },
              },
            ],
          },
        ],
      },
    ],
  },
]
