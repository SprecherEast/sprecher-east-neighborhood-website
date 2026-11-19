import { describe, expect, it } from 'vitest'

import { FigureBlockConfig } from './figureBlockConfig'

const field = (name: string) =>
  FigureBlockConfig.fields.find((f) => 'name' in f && f.name === name) as Record<string, unknown>

describe('the figure block', () => {
  it('has the fields the editor fills, in reading order', () => {
    expect(FigureBlockConfig.fields.map((f) => ('name' in f ? f.name : '?'))).toEqual([
      'image',
      'title',
      'label',
      'caption',
      'longCaption',
      'size',
      'items',
    ])
  })

  it('needs an image and a title, and nothing else', () => {
    expect(field('image').required).toBe(true)
    expect(field('title').required).toBe(true)
    expect(field('label').required).toBeFalsy()
    expect(field('items').required).toBeFalsy()
  })

  it('offers the three widths with two fifths first and default', () => {
    expect(field('size').defaultValue).toBe('two-fifths')
    expect((field('size').options as { value: string }[]).map((o) => o.value)).toEqual([
      'two-fifths',
      'third',
      'half',
    ])
  })

  it('gives every nested list an admin key (Payload crashes without it)', () => {
    expect(field('items').admin).toBeDefined()
  })
})
