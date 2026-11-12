// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { SHARE_BAR_INSIDE_MIN, ShareBar, type ShareBarSlice } from './ShareBar'
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

describe('ShareBar', () => {
  it('draws each slice as wide as its share, in the order given, as percent attributes', () => {
    const { container } = render(<ShareBar slices={SLICES} label="Whole bill" />)
    expect(rects(container).map((rect) => rect.getAttribute('data-share-slice'))).toEqual([
      'a',
      'b',
      'c',
      'd',
    ])
    expect(rects(container).map((rect) => rect.getAttribute('width'))).toEqual([
      '37.5%',
      '46.5%',
      '12.5%',
      '3.5%',
    ])
    expect(rects(container).map((rect) => rect.getAttribute('x'))).toEqual([
      '0%',
      '37.5%',
      '84%',
      '96.5%',
    ])
    expect(container.querySelector('[style]')).toBeNull()
  })

  it('scales shares that do not add up to 100 so the bar is always full', () => {
    const { container } = render(
      <ShareBar
        slices={[
          { key: 'a', share: 1, tone: 'light' },
          { key: 'b', share: 3, tone: 'medium' },
        ]}
        label="Two"
      />,
    )
    expect(rects(container).map((rect) => rect.getAttribute('width'))).toEqual(['25%', '75%'])
  })

  it('writes a label inside a slice only when the slice is wide enough', () => {
    const { container } = render(<ShareBar slices={SLICES} label="Whole bill" />)
    const written = Array.from(container.querySelectorAll('text')).map((text) => text.textContent)
    expect(SHARE_BAR_INSIDE_MIN).toBeGreaterThan(3.5)
    expect(written).toEqual(['38%', '46%', '13%'])
  })

  it('is one named picture and has no accessibility violations', async () => {
    const { container } = render(<ShareBar slices={SLICES} label="Sample: a whole split in four" />)
    screen.getByRole('img', { name: 'Sample: a whole split in four' })
    await expectAccessible(container)
  })
})
