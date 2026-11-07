import type { Field, TextField } from 'payload'
import { describe, expect, it } from 'vitest'

import { MapBlock } from './mapBlock'

const field = <T extends Field>(name: string) =>
  MapBlock.fields.find((f) => 'name' in f && f.name === name) as T

describe('MapBlock config (#764)', () => {
  it('is the page builder’s "mapBlock", typed as MapBlock', () => {
    expect(MapBlock.slug).toBe('mapBlock')
    expect(MapBlock.interfaceName).toBe('MapBlock')
  })

  it('asks for a title, a text description and a preview picture, and the address is optional', () => {
    expect(field('title')).toMatchObject({ type: 'text', required: true })
    expect(field('description')).toMatchObject({ type: 'textarea', required: true })
    expect(field('preview')).toMatchObject({ type: 'upload', relationTo: 'media', required: true })
    expect(field<TextField>('embedUrl').required).not.toBe(true)
  })

  describe('the embed address', () => {
    const embedUrl = field<TextField>('embedUrl')
    const validate = embedUrl.validate as (value: string | null | undefined) => true | string

    it('accepts nothing yet, a Google map embed address, or a pasted iframe', () => {
      expect(validate(undefined)).toBe(true)
      expect(validate('')).toBe(true)
      expect(validate('https://www.google.com/maps/d/embed?mid=1AbC_dEf')).toBe(true)
      expect(validate('<iframe src="https://www.google.com/maps/embed?pb=1"></iframe>')).toBe(true)
    })

    it('refuses any other address with a message that says what to paste', () => {
      const message = validate('https://example.com/map')
      expect(message).toEqual(expect.stringContaining('Google'))
      expect(validate('https://www.google.com/maps/embed/v1/place?key=SECRET&q=x')).not.toBe(true)
    })

    it('stores the address from a pasted iframe, not the whole snippet', () => {
      const [normalize] = embedUrl.hooks?.beforeValidate ?? []
      const snippet = '<iframe src="https://www.google.com/maps/embed?pb=1" width="600"></iframe>'
      expect(normalize({ value: snippet } as never)).toBe('https://www.google.com/maps/embed?pb=1')
      expect(normalize({ value: 'https://example.com/map' } as never)).toBe(
        'https://example.com/map',
      )
    })
  })
})
