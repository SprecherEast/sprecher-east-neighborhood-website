import type { TextFieldSingleValidation } from 'payload'
import { describe, expect, it } from 'vitest'

import { validateRatesNote } from './billShareBlockConfig'

const check = (text: string) =>
  (validateRatesNote as TextFieldSingleValidation)(
    text,
    {} as Parameters<TextFieldSingleValidation>[1],
  )

describe('the rates panel note’s check (#1351)', () => {
  it('accepts no note, plain words and {year}', () => {
    expect(check('')).toBe(true)
    expect(check('Rates come in January.')).toBe(true)
    expect(check('The other {year} rates come in January.')).toBe(true)
  })

  it('refuses a blank this note can’t fill, saying which one is allowed', () => {
    expect(check('Missing: {bodies}.')).toMatch(/\{bodies\} can’t be used/)
    expect(check('See {link}.')).toBe('{link} can’t be used in this note. Use {year}.')
  })
})
