// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  SHARE_BAR_GAP,
  SHARE_BAR_INSIDE_MIN,
  SHARE_BAR_RISE,
  ShareBar,
  type ShareBarSlice,
} from './ShareBar.client'
import { expectAccessible } from './testing/expectAccessible'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const SLICES: ShareBarSlice[] = [
  { key: 'a', share: 46.5, tone: 'strong', label: '46%' },
  { key: 'b', share: 37.5, tone: 'highlight', label: '38%' },
  { key: 'c', share: 12.5, tone: 'medium', label: '13%' },
  { key: 'd', share: 3.5, tone: 'light', label: '3%' },
]

const rects = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<SVGRectElement>('rect[data-share-slice]'))

/** Makes the bar measure this many pixels wide, as a browser would */
function measuredAt(width: number) {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    width,
    height: 100,
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: width,
    bottom: 100,
    toJSON: () => ({}),
  })
}

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

  it('writes a label inside every slice wide enough for it', () => {
    const { container } = render(<ShareBar slices={SLICES} label="Whole bill" />)
    const inside = Array.from(container.querySelectorAll('text:not([data-share-label-outside])'))
    expect(inside.map((t) => t.textContent)).toEqual(['46%', '38%', '13%'])
  })

  it('puts the label of a slice too narrow for it above the slice, with a tick to it', () => {
    const { container } = render(<ShareBar slices={SLICES} label="Whole bill" />)
    const outside = container.querySelectorAll('[data-share-label-outside]')
    expect(outside).toHaveLength(1)
    expect(outside[0]?.textContent).toBe('3%')
    expect(container.querySelectorAll('line[data-share-tick]')).toHaveLength(1)
    expect(3.5).toBeLessThan(SHARE_BAR_INSIDE_MIN)
  })

  it("ends the tick on the narrow slice's own top, the raised City slice included", () => {
    const plain = render(<ShareBar slices={SLICES} label="Whole bill" />).container
    const plainTick = plain.querySelector('line[data-share-tick]')
    const plainTop = rects(plain)
      .find((r) => r.dataset.shareSlice === 'd')
      ?.getAttribute('y')
    expect(plainTick?.getAttribute('y2')).toBe(plainTop)
    cleanup()
    const raised = SLICES.map((s) =>
      s.key === 'd' ? { ...s, tone: 'highlight' as const } : { ...s, tone: 'light' as const },
    )
    const { container } = render(<ShareBar slices={raised} label="Whole bill" />)
    const tick = container.querySelector('line[data-share-tick]')
    const top = rects(container)
      .find((r) => r.dataset.shareSlice === 'd')
      ?.getAttribute('y')
    expect(tick?.getAttribute('y2')).toBe(top)
  })

  it('leaves the row above the bar out when every label fits inside', () => {
    const wide = SLICES.map((s) => (s.key === 'd' ? { ...s, share: 10, label: '10%' } : s))
    const height = (c: HTMLElement) => Number(c.querySelector('svg')?.getAttribute('height'))
    const tall = height(render(<ShareBar slices={SLICES} label="Whole bill" />).container)
    cleanup()
    const short = render(<ShareBar slices={wide} label="Whole bill" />).container
    expect(tall).toBeGreaterThan(height(short))
    expect(short.querySelectorAll('[data-share-label-outside]')).toHaveLength(0)
  })

  it('raises the highlighted slice above the others by the rise', () => {
    const { container } = render(<ShareBar slices={SLICES} label="Whole bill" />)
    const [a, b] = rects(container)
    const lift = Number(b?.getAttribute('y'))
    expect(Number(a?.getAttribute('y')) - lift).toBe(SHARE_BAR_RISE)
  })

  it('outlines only the highlighted slice, running down GAP px to the panel', () => {
    const { container } = render(<ShareBar slices={SLICES} label="Whole bill" />)
    expect(container.querySelectorAll('[data-share-outline]')).toHaveLength(1)
    const outline = container.querySelector('[data-share-outline]')
    // One continuous line per side (the edge and its curve are one path), so no seam can show
    expect(outline?.querySelectorAll('path')).toHaveLength(2)
    expect(outline?.querySelectorAll('path[d*="A "]')).toHaveLength(2)
    expect(SHARE_BAR_GAP).toBe(10)
  })

  it('draws no outline when nothing is highlighted', () => {
    const plain = SLICES.map((s) => ({ ...s, tone: 'light' as const }))
    const { container } = render(<ShareBar slices={plain} label="Whole bill" />)
    expect(container.querySelector('[data-share-outline]')).toBeNull()
  })

  it('lands every edge on a whole pixel once it knows its width, so the corners stay crisp', () => {
    measuredAt(613)
    const { container } = render(<ShareBar slices={SLICES} label="Whole bill" />)
    const slices = rects(container)
    const xs = slices.map((r) => Number(r.getAttribute('x')))
    const widths = slices.map((r) => Number(r.getAttribute('width')))
    expect([...xs, ...widths].every(Number.isInteger)).toBe(true)
    // Slices still fill the bar exactly, side by side
    expect((xs.at(-1) ?? 0) + (widths.at(-1) ?? 0)).toBe(613)
    xs.slice(1).forEach((x, i) => expect(x).toBe((xs[i] ?? 0) + (widths[i] ?? 0)))
    const edges = Array.from(container.querySelectorAll('[data-share-outline] svg')).map((s) =>
      Number(s.getAttribute('x')),
    )
    expect(edges.every(Number.isInteger)).toBe(true)
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

beforeEach(() => {
  vi.unstubAllGlobals()
})
