import type { ArrayField, TextFieldSingleValidation } from 'payload'

import { DEFAULT_BILL_TOASTS } from './billShareDefaults'
import { validateNoteBlanks } from './billShareNotes'
import { BILL_TOAST_IDS, BILL_TOAST_LABELS, BILL_TOAST_TONES } from './billToasts'
import { BILL_SHARE_LIMITS } from './editorialLimits'
import { rowsBetween } from './rowCount'

/** A message may be empty, and may use {year} only: no other blank, and no link to put in one */
export const validateToastMessage: TextFieldSingleValidation = (value) =>
  (value ?? '').includes('{link}')
    ? '{link} can’t be used in this message. Use {year}.'
    : validateNoteBlanks(value ?? '', { showWhen: 'always' })

/** Each toast is set once: a second row for the same toast would never be shown */
export const validateToastRows = (value: unknown, args: { event?: unknown }): true | string => {
  const counted = rowsBetween(0, BILL_TOAST_IDS.length, 'toasts')(value, args)
  if (counted !== true || !Array.isArray(value)) return counted
  const ids = value.map((row) => (row as { id?: unknown; toast?: unknown }).toast)
  return new Set(ids).size === ids.length ? true : 'Each toast can be set once.'
}

/** The toasts the whole-bill block lets an editor word (#1379) */
export const billToastsField: ArrayField = {
  name: 'toasts',
  type: 'array',
  labels: { singular: 'Toast', plural: 'Toasts' },
  maxRows: BILL_TOAST_IDS.length,
  validate: validateToastRows,
  defaultValue: BILL_TOAST_IDS.map((toast) => ({ toast, ...DEFAULT_BILL_TOASTS[toast] })),
  admin: {
    description:
      'The small notices that pop up over a panel. Each one is shown by the page when it applies; here you set what it says and how it ends. Empty a message to turn that toast off.',
  },
  fields: [
    {
      name: 'toast',
      type: 'select',
      label: 'Shown when',
      required: true,
      options: BILL_TOAST_IDS.map((value) => ({ value, label: BILL_TOAST_LABELS[value] })),
    },
    {
      name: 'tone',
      type: 'select',
      label: 'Kind',
      required: true,
      defaultValue: 'info',
      options: BILL_TOAST_TONES.map((value) => ({ value, label: value })),
      admin: {
        width: '50%',
        description: 'Information is blue, success green, warning amber, error red.',
      },
    },
    {
      name: 'ending',
      type: 'select',
      label: 'Ends when',
      required: true,
      defaultValue: 'accept',
      options: [
        { value: 'fade', label: 'It fades by itself' },
        { value: 'close', label: 'The reader closes it' },
        { value: 'accept', label: 'The reader accepts it' },
      ],
      admin: { width: '50%' },
    },
    {
      name: 'fadeSeconds',
      type: 'number',
      label: 'Seconds before it fades',
      min: BILL_SHARE_LIMITS.toastMinSeconds,
      max: BILL_SHARE_LIMITS.toastMaxSeconds,
      defaultValue: 5,
      admin: { condition: (_, sibling) => sibling?.ending === 'fade' },
    },
    {
      name: 'acceptLabel',
      type: 'text',
      label: 'Accept button',
      maxLength: BILL_SHARE_LIMITS.toastAcceptLabel,
      defaultValue: 'Got it',
      admin: { condition: (_, sibling) => sibling?.ending === 'accept' },
    },
    {
      name: 'title',
      type: 'text',
      label: 'Heading (optional)',
      maxLength: BILL_SHARE_LIMITS.toastTitle,
    },
    {
      name: 'message',
      type: 'text',
      label: 'Message',
      maxLength: BILL_SHARE_LIMITS.toastMessage,
      validate: validateToastMessage,
      admin: {
        description: '{year} is the year shown. Leave empty to turn this toast off.',
      },
    },
  ],
}
