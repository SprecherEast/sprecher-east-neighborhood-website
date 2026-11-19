import { describe, expect, it } from 'vitest'

import type { Media } from '@/payload-types'
import { ROADMAP_PATH } from '@/modules/roadmap'
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
  type Item = { width?: string | null; content?: Record<string, unknown>[] | null }
  const items = (layout[0] as { items: Item[] }).items
  const map = items[1].content?.[0] as {
    blockType: string
    title: string
    description: string
    embedUrl?: string | null
    preview?: number
  }

  it('says what the site is first, then where we are, then how AI helps, then the call to act', () => {
    expect(layout.map((block) => block.blockType)).toEqual(['section', 'content', 'cta'])
    expect(headings(items[0])).toEqual(['What this site is'])
    expect(map).toMatchObject({ blockType: 'mapBlock', title: 'Where we are' })
    expect(headings(layout[1])).toEqual(['How AI helps'])
  })

  it('puts the text beside the map, half and half, set as fields an editor can change', () => {
    expect(items.map((item) => item.width)).toEqual(['half', 'half'])
  })

  it('opens the first section with the site, not the neighborhood', () => {
    const first = textOf(items[0])
    expect(first.join(' ')).toMatch(/This is an unofficial site/)
    expect(first.join(' ')).toMatch(/run by one neighbor/)
  })

  it('gives the map block the Sprecher East My Maps address, which the site accepts', () => {
    expect(map.embedUrl).toBe(
      'https://www.google.com/maps/d/embed?mid=1mbTKP1-2eN6g5YPReAaQg6J1lV2DX7g',
    )
    expect(toGoogleMapsEmbedUrl(map.embedUrl)).toBe(map.embedUrl)
    expect(map.preview).toBe(7)
  })

  it('names the boundary and what touches it, from the verified area', () => {
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

  it('links our plan with an outline button in the How AI helps column, as the live page does (#953)', () => {
    const [column] = (layout[1] as { columns: Record<string, unknown>[] }).columns
    expect(column.enableLink).toBe(true)
    expect(column.linkAlign).toBe('end')
    expect(column.link).toEqual({
      type: 'custom',
      appearance: 'outline',
      label: 'See our progress',
      url: ROADMAP_PATH,
    })
    expect(ROADMAP_PATH).toBe('/roadmap')
  })

  it('has no plain-text line about the plan, and no other link to it', () => {
    expect(textOf(page).join(' ')).not.toMatch(/See our plan|Curious what we/)
    const links = JSON.stringify(page).match(/"url":"\/roadmap"/g) ?? []
    expect(links).toHaveLength(1)
    expect(JSON.stringify(layout[0])).not.toContain(ROADMAP_PATH)
    expect(JSON.stringify(layout[2])).not.toContain(ROADMAP_PATH)
  })

  it('links no post that is gone, and drops the subdivisions that have no source (#1010)', () => {
    const all = JSON.stringify(page)
    expect(all).not.toContain('/posts/sprecher-east-is-coming-together')
    expect(all).not.toMatch(/Meadowlands|Reston Heights subdivision/)
  })

  it('writes "we" and "us", never "I" or "me", and names AI tools, not a model', () => {
    const words = textOf(page).join(' ')
    expect(words).not.toMatch(/(?<![\w-])(I|me|my)(?![\w-])/)
    expect(words).toContain('AI tools')
    expect(words).not.toMatch(/Claude|Gemini|Grok|ChatGPT/)
  })

  it('keeps every sentence to 25 words and avoids the word "resident"', () => {
    const pieces = textOf(page)
    for (const piece of pieces) {
      for (const sentence of piece.split(/(?<=[.!?])\s+/)) {
        expect(sentence.trim().split(/\s+/).length, sentence).toBeLessThanOrEqual(25)
      }
    }
    expect(pieces.join(' ')).not.toMatch(/resident/i)
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
