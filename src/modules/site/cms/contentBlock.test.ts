import type { Field, GroupField } from 'payload'
import { describe, expect, it } from 'vitest'

import { Content } from './contentBlock'

describe('Content block', () => {
  it('lets an editor give a column link the orange look (#1050)', () => {
    const columns = Content.fields.find((field) => 'name' in field && field.name === 'columns')
    const columnFields: Field[] = columns && 'fields' in columns ? columns.fields : []
    const link = columnFields.find((field) => 'name' in field && field.name === 'link') as
      | GroupField
      | undefined
    const look = link?.fields.find((field) => 'name' in field && field.name === 'appearance')

    const values =
      look && 'options' in look
        ? look.options.map((option) => (typeof option === 'string' ? option : option.value))
        : []
    expect(values).toEqual(['default', 'outline', 'accent'])
  })
})
