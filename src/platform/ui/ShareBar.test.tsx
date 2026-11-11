// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { SHARE_BAR_GAP, ShareBar, type ShareBarSlice } from './ShareBar'
import { expectAccessible } from './testing/expectAccessible'

afterEach(cleanup)

const SLICES: ShareBarSlice[] = [
  { key: 'a', share: 46.5, tone: 'strong', label: '46%' },
  { key: 'b', share: 37.5, tone: 'highlight', label: '38%' },
  { key: 'c', share: 12.5, tone: 'medium', label: '13%' },
  { key: 'd', share: 3.5, tone: 'light' },
]

const rects = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<SVGRectElement>('rect[data-share-slice]'))

describe('ShareBar', () => {
  it('draws one slice per part, as wide as its exact share, side by side', () => {
    const { container } = render(<ShareBar slices={SLICES} label="Whole bill" />)
    const slices = rects(container)
    expect(slices.map((r) => r.getAttribute('data-share-slice'))).toEqual(['a', 'b', 'c', 'd'])
    expect(slices.map((r) => r.getAttribute('width'))).toEqual(['46.5%', '37.5%', '12.5%', '3.5%'])
    expect(slices.map((r) => r.getAttribute('x'))).toEqual(['0%', '46.5%', '84%', '96.5%'])
  })

  it('is one named picture for screen readers, with no per-slice noise', () => {
    render(<ShareBar slices={SLICES} label="Whole bill" />)
    expect(screen.getByRole('img', { name: 'Whole bill' })).toBeTruthy()
  })

  it('writes a slice’s label inside it only when it has one', () => {
    const { container } = render(<ShareBar slices={SLICES} label="Whole bill" />)
    expect(Array.from(container.querySelectorAll('text')).map((t) => t.textContent)).toEqual([
      '46%',
      '38%',
      '13%',
    ])
  })

  it('outlines only the highlighted slice, running down GAP px to the panel', () => {
    const { container } = render(<ShareBar slices={SLICES} label="Whole bill" />)
    expect(container.querySelectorAll('[data-share-outline]')).toHaveLength(1)
    const outline = container.querySelector('[data-share-outline]')
    expect(outline?.querySelectorAll('path')).toHaveLength(2)
    expect(SHARE_BAR_GAP).toBe(10)
  })

  it('draws no outline when nothing is highlighted', () => {
    const plain = SLICES.map((s) => ({ ...s, tone: 'light' as const }))
    const { container } = render(<ShareBar slices={plain} label="Whole bill" />)
    expect(container.querySelector('[data-share-outline]')).toBeNull()
  })

  it('holds its children in the panel under the bar', () => {
    render(
      <ShareBar slices={SLICES} label="Whole bill">
        <p>City detail</p>
      </ShareBar>,
    )
    expect(screen.getByText('City detail')).toBeTruthy()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(
      <ShareBar slices={SLICES} label="Whole bill">
        <p>City detail</p>
      </ShareBar>,
    )
    await expectAccessible(container)
  })
})
