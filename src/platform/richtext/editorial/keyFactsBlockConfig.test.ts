import { describe, expect, it } from 'vitest'

import { KEY_FACT_LIMITS } from './editorialLimits'
import { keyFactFields, KeyFactsBlockConfig } from './keyFactsBlockConfig'

function names(fields: unknown[]): string[] {
  return fields.flatMap((field) => {
    const f = field as { name?: string; fields?: unknown[] }
    return f.fields ? names(f.fields) : f.name ? [f.name] : []
  })
}

describe('keyFactFields', () => {
  it('gives label, value, detail, icon, certainty and the link, in the order the card reads', () => {
    expect(names(keyFactFields())).toEqual([
      'label',
      'value',
      'detail',
      'icon',
      'certainty',
      'linkLabel',
      'linkUrl',
    ])
  })

  it('is what the key facts block stores for each fact', () => {
    const facts = KeyFactsBlockConfig.fields[0] as { fields: unknown[] }
    expect(facts.fields).toEqual(keyFactFields())
  })

  it('keeps the explanation optional and short enough for a phone card', () => {
    const detail = keyFactFields()
      .flatMap((field) => ('fields' in field ? field.fields : [field]))
      .find((field) => 'name' in field && field.name === 'detail')

    expect(detail).toMatchObject({ type: 'text', maxLength: KEY_FACT_LIMITS.detail })
    expect(detail).not.toHaveProperty('required', true)
  })
})

describe('the facts row count', () => {
  const check = (
    KeyFactsBlockConfig.fields[0] as unknown as {
      validate: (value: unknown, args: { event?: unknown }) => true | string
    }
  ).validate

  it('says why under the field while Admin counts the rows, and clears at the second', () => {
    expect(check(1, { event: 'onChange' })).toMatch(/^Add 2 to 6 facts: there is 1/)
    expect(check(7, { event: 'onChange' })).toMatch(/^Add 2 to 6 facts: there are 7/)
    expect(check(2, { event: 'onChange' })).toBe(true)
    expect(check([{ id: 'a' }, { id: 'b' }], { event: 'onChange' })).toBe(true)
    expect(check([{ id: 'a' }], { event: 'onChange' })).toMatch(/there is 1/)
  })

  it('reads a number as no rows on the real save', () => {
    expect(check(3, { event: 'submit' })).toMatch(/there are 0/)
  })
})
