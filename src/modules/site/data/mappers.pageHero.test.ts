import { describe, expect, it } from 'vitest'

import type { Media, Page } from '@/payload-types'

import { toPageHeroProps } from './mappers'

/* `toPageHeroProps` (mappers.ts), apart from the blocks' tests so each file stays short. */

type Hero = Page['hero']

const richText: NonNullable<Hero['richText']> = {
  root: {
    type: 'root',
    children: [{ type: 'heading', version: 1 }],
    direction: null,
    format: '',
    indent: 0,
    version: 1,
  },
}
const image = { id: 4, alt: 'The pond at sunset', url: '/media/pond.jpg' } as Media
const links: Hero['links'] = [
  { link: { type: 'custom', url: '/events', label: 'Upcoming Events', appearance: 'default' } },
  { link: { type: 'custom', url: '/get-involved', label: 'Get Involved', appearance: 'outline' } },
  { link: { type: 'reference', reference: null, label: 'Deleted page' } },
]
const events = { href: '/events', label: 'Upcoming Events', external: false, appearance: 'default' }
const involved = {
  href: '/get-involved',
  label: 'Get Involved',
  external: false,
  appearance: 'outline',
}

describe('toPageHeroProps', () => {
  it.each([
    ['highImpact', 'high'],
    ['mediumImpact', 'medium'],
  ] as const)('maps a %s hero with its text, image and links that go somewhere', (type, variant) => {
    expect(toPageHeroProps({ type, richText, media: image, links })).toEqual({
      variant,
      body: richText,
      image,
      links: [events, involved],
    })
  })

  it('keeps a photo hero with no image, or no links', () => {
    expect(toPageHeroProps({ type: 'highImpact', richText, media: null })).toEqual({
      variant: 'high',
      body: richText,
      links: [],
    })
    // An image not loaded (only its id) shows as no image
    expect(toPageHeroProps({ type: 'mediumImpact', media: 4, links })).toEqual({
      variant: 'medium',
      links: [events, involved],
    })
  })

  it('keeps only the text of a low hero, which draws no image or links', () => {
    expect(toPageHeroProps({ type: 'lowImpact', richText, media: image, links })).toEqual({
      variant: 'low',
      body: richText,
    })
  })

  it.each<[string, Hero]>([
    ['type none', { type: 'none', richText, media: image, links }],
    ['a low hero with no text', { type: 'lowImpact', richText: null, links }],
    ['a photo hero with nothing in it', { type: 'highImpact', media: null, links: [links[2]] }],
  ])('draws no hero for %s', (_case, hero) => {
    expect(toPageHeroProps(hero)).toBeNull()
  })
})
