import { describe, expect, it } from 'vitest'

import type { Media } from '@/payload-types'
import { toGoogleMapsEmbedUrl } from '@/platform/lib/googleMapsEmbed'

import { aboutPage } from './about-page'

const mapImage = { id: 7 } as Media

/** Every piece of text in a block, in order, so a test can read what a neighbor reads */
function textOf(value: unknown): string[] {
  if (typeof value === 'string') return []
  if (Array.isArray(value)) return value.flatMap(textOf)
  if (value && typeof value === 'object') {
    const node = value as Record<string, unknown>
    return [
      ...(typeof node.text === 'string' ? [node.text] : []),
      ...Object.values(node).flatMap(textOf),
    ]
  }
  return []
}

function headings(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(headings)
  if (value && typeof value === 'object') {
    const node = value as Record<string, unknown>
    const own = node.type === 'heading' ? [textOf(node.children).join('')] : []
    return [...own, ...Object.values(node).flatMap(headings)]
  }
  return []
}

describe('About page seed (#764)', () => {
  const page = aboutPage({ mapImage })
  const layout = page.layout ?? []

  it('says what the site is first, then where we are, then how AI helps, then the call to act', () => {
    expect(layout.map((block) => block.blockType)).toEqual([
      'content',
      'mapBlock',
      'content',
      'cta',
    ])
    expect(headings(layout[0])).toEqual(['What this site is'])
    expect(layout[1]).toMatchObject({ blockType: 'mapBlock', title: 'Where we are' })
    expect(headings(layout[2])).toEqual(['How AI helps'])
  })

  it('opens the first section with the site, not the neighborhood', () => {
    const first = textOf(layout[0])
    expect(first.join(' ')).toMatch(/This is an unofficial site/)
    expect(first.join(' ')).toMatch(/one-resident project/)
  })

  it('gives the map block the Sprecher East My Maps address, which the site accepts', () => {
    const map = layout[1] as { embedUrl?: string | null; preview?: number }
    expect(map.embedUrl).toBe(
      'https://www.google.com/maps/d/embed?mid=1mbTKP1-2eN6g5YPReAaQg6J1lV2DX7g',
    )
    expect(toGoogleMapsEmbedUrl(map.embedUrl)).toBe(map.embedUrl)
    expect(map.preview).toBe(7)
  })

  it('names the boundary and what touches it, from the verified area', () => {
    const map = layout[1] as { description: string }
    for (const place of [
      'I-94',
      'Sprecher Road',
      'Cottage Grove Road',
      'Door Creek Park',
      'District 16',
      'North Star',
      'Richmond Hill',
    ]) {
      expect(map.description).toContain(place)
    }
  })

  it('keeps the story link and drops the subdivisions that have no source', () => {
    const all = JSON.stringify(page)
    expect(all).toContain('/posts/sprecher-east-is-coming-together')
    expect(all).not.toMatch(/Meadowlands|Reston Heights subdivision/)
  })

  it('writes "we" and "us", never "I" or "me", and names AI tools, not a model', () => {
    const words = textOf(page).join(' ')
    expect(words).not.toMatch(/(?<![\w-])(I|me|my)(?![\w-])/)
    expect(words).toContain('AI tools')
    expect(words).not.toMatch(/Claude|Gemini|Grok|ChatGPT/)
  })

  it('leaves the map block out when there is no preview picture', () => {
    const bare = aboutPage()
    expect((bare.layout ?? []).map((block) => block.blockType)).toEqual([
      'content',
      'content',
      'cta',
    ])
  })
})
