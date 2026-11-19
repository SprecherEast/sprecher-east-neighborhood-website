import type { Field, SelectField } from 'payload'
import { describe, expect, it } from 'vitest'

import { SectionBlock, SECTION_ITEM_BLOCKS } from './sectionBlock'

const items = SectionBlock.fields.find((f) => 'name' in f && f.name === 'items') as Field & {
  fields: Field[]
}
const itemField = <T extends Field>(name: string) =>
  items.fields.find((f) => 'name' in f && f.name === name) as T

describe('SectionBlock config (#884)', () => {
  it('is the page builder’s "section", typed as SectionBlock', () => {
    expect(SectionBlock.slug).toBe('section')
    expect(SectionBlock.interfaceName).toBe('SectionBlock')
  })

  it('needs at least one item', () => {
    expect(items).toMatchObject({ type: 'array', required: true, minRows: 1 })
  })

  it('gives every item its layout as plain fields, each with a safe default', () => {
    expect(itemField<SelectField>('width').defaultValue).toBe('full')
    expect(itemField<SelectField>('align').defaultValue).toBe('start')
    expect(itemField<SelectField>('verticalAlign').defaultValue).toBe('top')
    expect(itemField<SelectField>('phoneOrder').defaultValue).toBe('inOrder')
  })

  it('offers the six widths, from a quarter to the full row', () => {
    const values = itemField<SelectField>('width').options.map((o) =>
      typeof o === 'string' ? o : o.value,
    )
    expect(values).toEqual(['full', 'threeQuarters', 'twoThirds', 'half', 'oneThird', 'quarter'])
  })

  it('lets an item hold text, a picture or a map, and never another section or a band', () => {
    expect(SECTION_ITEM_BLOCKS.map((b) => b.slug)).toEqual(['content', 'mediaBlock', 'mapBlock'])
    expect(itemField('content')).toMatchObject({ type: 'blocks' })
  })
})
