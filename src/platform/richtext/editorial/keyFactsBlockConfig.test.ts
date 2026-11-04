import { describe, expect, it } from 'vitest'

import { keyFactFields, KeyFactsBlockConfig } from './keyFactsBlockConfig'

function names(fields: unknown[]): string[] {
  return fields.flatMap((field) => {
    const f = field as { name?: string; fields?: unknown[] }
    return f.fields ? names(f.fields) : f.name ? [f.name] : []
  })
}

describe('keyFactFields', () => {
  it('gives value, label, icon, certainty and the link, in that order', () => {
    expect(names(keyFactFields())).toEqual([
      'value',
      'label',
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
})
