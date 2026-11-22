import type { TextFieldSingleValidation } from 'payload'
import { describe, expect, it } from 'vitest'

import { BillShareBlockConfig } from './billShareBlockConfig'
import { DEFAULT_BILL_TOASTS } from './billShareDefaults'
import { validateToastMessage, validateToastRows } from './billToastFields'

const check = (text: string) =>
  (validateToastMessage as TextFieldSingleValidation)(
    text,
    {} as Parameters<TextFieldSingleValidation>[1],
  )

describe('a toast message’s check (#1351, #1379)', () => {
  it('accepts no note, plain words and {year}', () => {
    expect(check('')).toBe(true)
    expect(check('Rates come in January.')).toBe(true)
    expect(check('The other {year} rates come in January.')).toBe(true)
  })

  it('refuses a blank this note can’t fill, saying which one is allowed', () => {
    expect(check('Missing: {bodies}.')).toMatch(/\{bodies\} can’t be used/)
    expect(check('See {link}.')).toBe('{link} can’t be used in this message. Use {year}.')
  })
})

describe('the toasts list (#1379)', () => {
  const rows = (...toasts: string[]) => toasts.map((toast) => ({ toast }))
  const toastsField = () =>
    (BillShareBlockConfig.fields as { name?: string; defaultValue?: unknown }[]).find(
      (field) => field.name === 'toasts',
    )

  it('accepts each toast once, in any order, and none', () => {
    expect(validateToastRows(rows('ratesOwn', 'ratesCarried'), {})).toBe(true)
    expect(validateToastRows(rows('ratesOwn'), {})).toBe(true)
    expect(validateToastRows([], {})).toBe(true)
  })

  it('refuses the same toast twice, since the second would never be shown', () => {
    expect(validateToastRows(rows('ratesOwn', 'ratesOwn'), {})).toBe('Each toast can be set once.')
  })

  it('starts a new block with every toast’s starting definition', () => {
    expect(toastsField()?.defaultValue).toEqual([
      { toast: 'ratesCarried', ...DEFAULT_BILL_TOASTS.ratesCarried },
      { toast: 'ratesOwn', ...DEFAULT_BILL_TOASTS.ratesOwn },
      { toast: 'aboutAnswer', ...DEFAULT_BILL_TOASTS.aboutAnswer },
      { toast: 'aboutRates', ...DEFAULT_BILL_TOASTS.aboutRates },
      { toast: 'aboutBill', ...DEFAULT_BILL_TOASTS.aboutBill },
    ])
  })
})
