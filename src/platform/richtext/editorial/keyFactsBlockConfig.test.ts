import { describe, expect, it } from 'vitest'

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

    expect(detail).toMatchObject({ type: 'text', maxLength: 90 })
    expect(detail).not.toHaveProperty('required', true)
  })
})
