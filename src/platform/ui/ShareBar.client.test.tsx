// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ShareBar, type ShareBarSlice } from './ShareBar.client'
import { SHARE_TONES } from './shareTones'
import { expectAccessible } from './testing/expectAccessible'

afterEach(cleanup)

const SLICES: ShareBarSlice[] = [
  { key: 'a', share: 37.5, tone: 'highlight', label: '38%' },
  { key: 'b', share: 46.5, tone: 'light', label: '46%' },
  { key: 'c', share: 12.5, tone: 'medium', label: '13%' },
  { key: 'd', share: 3.5, tone: 'strong', label: '3%' },
]

const rects = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<SVGRectElement>('rect[data-share-slice]'))
const widths = (container: HTMLElement) =>
  rects(container).map((rect) => Number.parseFloat(rect.getAttribute('width') ?? '0'))

describe('ShareBar', () => {
  it('draws the slices in the order given, as percent attributes, never inline styles', () => {
    const { container } = render(<ShareBar slices={SLICES} label="Whole bill" />)
    expect(rects(container).map((rect) => rect.getAttribute('data-share-slice'))).toEqual([
      'a',
      'b',
      'c',
      'd',
    ])
    expect(rects(container).every((rect) => rect.getAttribute('width')?.endsWith('%'))).toBe(true)
    expect(container.querySelector('[style]')).toBeNull()
  })

  it('always fills the bar, also for shares that do not add up to 100', () => {
    const { container } = render(
      <ShareBar
        slices={[
          { key: 'a', share: 1, tone: 'light' },
          { key: 'b', share: 3, tone: 'medium' },
        ]}
        label="Two"
      />,
    )
    expect(widths(container)).toEqual([25, 75])
  })

  it('writes every slice’s label in it, the smallest too, in its tone’s label color (#1121)', () => {
    const { container } = render(<ShareBar slices={SLICES} label="Whole bill" />)
    const texts = Array.from(container.querySelectorAll('text'))
    expect(texts.map((text) => text.textContent)).toEqual(['38%', '46%', '13%', '3%'])
    expect(texts[0]?.getAttribute('class')).toContain(SHARE_TONES.highlight.label)
    expect(texts[3]?.getAttribute('class')).toContain(SHARE_TONES.strong.label)
  })

  it('draws a slice too narrow for its label at the least width that fits it, taking the rest from the others', () => {
    const { container } = render(<ShareBar slices={SLICES} label="Whole bill" />)
    const drawn = widths(container)
    expect(drawn.reduce((sum, width) => sum + width, 0)).toBeCloseTo(100, 2)
    // Its exact share is 3.5%; the guess for a two-character label asks for more
    expect(drawn[3]).toBeGreaterThan(3.5)
    // The exact shares are 37.5, 46.5, 12.5 and 3.5; the widest gave up the most
    expect(46.5 - (drawn[1] ?? 0)).toBeGreaterThan(0)
  })

  describe('with the bar and its labels measured', () => {
    beforeEach(() => {
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
        width: 200,
      } as DOMRect)
      Object.defineProperty(SVGElement.prototype, 'getComputedTextLength', {
        configurable: true,
        value: () => 20,
      })
    })
    afterEach(() => {
      vi.restoreAllMocks()
      Reflect.deleteProperty(SVGElement.prototype, 'getComputedTextLength')
    })

    it('gives each slice its label’s measured width plus the room around it', () => {
      const { container } = render(<ShareBar slices={SLICES} label="Whole bill" />)
      // (20 px of text + 2 × 8 px of room) of a 200 px bar
      expect(widths(container)[3]).toBeCloseTo(18, 1)
      expect(widths(container)[2]).toBeCloseTo(18, 1)
      expect(widths(container).reduce((sum, width) => sum + width, 0)).toBeCloseTo(100, 2)
    })
  })

  it('is one named picture and has no accessibility violations', async () => {
    const { container } = render(<ShareBar slices={SLICES} label="Sample: a whole split in four" />)
    screen.getByRole('img', { name: 'Sample: a whole split in four' })
    await expectAccessible(container)
  })
})
