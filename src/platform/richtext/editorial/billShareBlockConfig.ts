import type { Block, NumberField, TextField, TextFieldSingleValidation } from 'payload'

import { BILL_BODIES, BILL_BODY_NAMES, type BillBody } from '@/platform/lib/billShare'

import { DEFAULT_BILL_NOTES, DEFAULT_BILL_ROW_TITLES } from './billShareDefaults'
import {
  NOTE_BLANKS_HELP,
  NOTE_CONDITION_LABELS,
  NOTE_CONDITIONS,
  validateNoteBlanks,
} from './billShareNotes'
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

/** A note must have words, and use only the blanks and the link its condition allows */
const validateNote: TextFieldSingleValidation = (value, args) => {
  const empty = filledText('Write the note.')(value, args)
  if (empty !== true) return empty
  return validateNoteBlanks(
    value ?? '',
    args.siblingData as Parameters<typeof validateNoteBlanks>[1],
  )
}

/** A title the editor can change, that starts as the one the page used before it was a field */
const rowTitleField = (name: string, label: string, defaultValue: string): TextField => ({
  name,
  type: 'text',
  label,
  required: true,
  defaultValue,
  maxLength: BILL_SHARE_LIMITS.rowTitle,
  validate: filledText('Add the row’s title.'),
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
              admin: { width: '20%', description: 'The budget year: 2027.' },
            },
            {
              name: 'label',
              type: 'text',
              required: true,
              maxLength: BILL_SHARE_LIMITS.label,
              validate: filledText('Add the name readers see on the switch.'),
              admin: {
                width: '30%',
                description: 'On the switch: "2026 rates".',
              },
            },
            {
              name: 'note',
              type: 'text',
              maxLength: BILL_SHARE_LIMITS.note,
              label: 'Note under the switch',
              admin: {
                width: '25%',
                description:
                  'Shown in parentheses under the switch: "proposed". Leave empty once the rates are set.',
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
    {
      name: 'rows',
      type: 'group',
      label: 'Titles of the three rows under the bill',
      admin: { description: 'What each open-and-close row is called.' },
      fields: [
        rowTitleField('breakdown', 'City tax breakdown', DEFAULT_BILL_ROW_TITLES.breakdown),
        rowTitleField('differ', 'Notes on why the bill may differ', DEFAULT_BILL_ROW_TITLES.differ),
        rowTitleField('sources', 'Sources', DEFAULT_BILL_ROW_TITLES.sources),
      ],
    },
    {
      name: 'notes',
      type: 'array',
      labels: { singular: 'Note', plural: 'Notes' },
      maxRows: BILL_SHARE_LIMITS.notes,
      defaultValue: DEFAULT_BILL_NOTES.map((note) => ({ ...note })),
      admin: {
        description:
          'The lines in the row on why the bill may differ, in this order. Each says when it shows; a note can use blanks the page fills in.',
      },
      fields: [
        {
          name: 'showWhen',
          type: 'select',
          label: 'Shows',
          defaultValue: 'always',
          required: true,
          options: NOTE_CONDITIONS.map((value) => ({
            value,
            label: NOTE_CONDITION_LABELS[value],
          })),
        },
        {
          name: 'text',
          type: 'text',
          label: 'Note',
          required: true,
          maxLength: BILL_SHARE_LIMITS.noteText,
          admin: { description: NOTE_BLANKS_HELP },
          validate: validateNote,
        },
        editorialLinkFields({ labelExample: 'send us a note' }),
      ],
    },
  ],
}
