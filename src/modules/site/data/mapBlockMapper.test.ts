import { describe, expect, it } from 'vitest'

import type { MapBlock } from '@/payload-types'

import { toMapBlockProps } from './mappers'

describe('toMapBlockProps (#764)', () => {
  const image = { id: 9, alt: 'Map of Sprecher East' } as never
  const stored = (overrides: Partial<MapBlock> = {}): MapBlock => ({
    blockType: 'mapBlock',
    id: 'm1',
    title: 'Where we are',
    description: 'Our boundary, with I-94 to the north.',
    embedUrl: 'https://www.google.com/maps/d/embed?mid=1AbC_dEf',
    preview: image,
    ...overrides,
  })

  it('hands the UI plain props: the text, the embed address and the loaded preview image', () => {
    expect(toMapBlockProps(stored())).toEqual({
      title: 'Where we are',
      description: 'Our boundary, with I-94 to the north.',
      embedUrl: 'https://www.google.com/maps/d/embed?mid=1AbC_dEf',
      preview: image,
    })
  })

  it('leaves out an address that is not a Google map embed, even if it was stored', () => {
    expect(toMapBlockProps(stored({ embedUrl: 'https://example.com/x' }))).not.toHaveProperty(
      'embedUrl',
    )
    expect(toMapBlockProps(stored({ embedUrl: null }))).not.toHaveProperty('embedUrl')
  })

  it('leaves out a preview that was not loaded (only its id)', () => {
    expect(toMapBlockProps(stored({ preview: 9 }))).not.toHaveProperty('preview')
  })
})
