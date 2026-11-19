import type { Field, GroupField } from 'payload'
import { describe, expect, it } from 'vitest'

import { link } from './link'

const nameOf = (field: Field) => ('name' in field ? field.name : '')
const names = (field: GroupField) =>
  field.fields.flatMap((child) =>
    child.type === 'row' ? child.fields.map(nameOf) : [nameOf(child)],
  )

describe('link', () => {
  it('merges overrides into the defaults, keeping the functions they pass', () => {
    const condition = () => true
    const field = link({ overrides: { admin: { condition } } }) as GroupField

    expect(field.admin).toEqual({ hideGutter: true, condition })
    expect(field.admin?.condition).toBe(condition)
    // The default fields are untouched (compared without their per-call condition functions)
    expect(JSON.stringify(field.fields)).toBe(JSON.stringify((link() as GroupField).fields))
  })

  it('replaces an array instead of adding to it', () => {
    const field = link({ overrides: { fields: [] } }) as GroupField

    expect(field.fields).toEqual([])
  })

  it('leaves out the label and the appearance when asked (#484)', () => {
    const field = link({ appearances: false, disableLabel: true }) as GroupField

    expect(names(field)).toEqual(['type', 'newTab', 'reference', 'url'])
  })

  it('offers the orange look only when asked for it', () => {
    const lookValues = (field: GroupField) => {
      const look = field.fields.find((child) => nameOf(child) === 'appearance')
      return look && 'options' in look
        ? look.options.map((option) => (typeof option === 'string' ? option : option.value))
        : []
    }

    expect(lookValues(link() as GroupField)).toEqual(['default', 'outline'])
    expect(
      lookValues(link({ appearances: ['default', 'outline', 'accent'] }) as GroupField),
    ).toEqual(['default', 'outline', 'accent'])
  })

  it('sets the document or URL beside the label, half the width each', () => {
    const row = (link() as GroupField).fields[1]

    expect(row.type).toBe('row')
    const widths = row.type === 'row' ? row.fields.map((f) => f.admin?.width) : []
    expect(widths).toEqual(['50%', '50%', '50%'])
  })
})
