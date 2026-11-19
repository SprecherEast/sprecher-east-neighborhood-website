// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { ShareStrip, type ShareStripPart } from './ShareStrip'
import { expectAccessible } from './testing/expectAccessible'

afterEach(cleanup)

const PARTS: ShareStripPart[] = [
  { name: 'Schools', percent: 50, tone: 'rust' },
  { name: 'City', percent: 30, tone: 'amber' },
  { name: 'County', percent: 15, tone: 'green' },
  { name: 'College', percent: 5, tone: 'mint' },
]

describe('ShareStrip', () => {
  it('draws one segment per part, each as wide as its percent, in its tone, side by side', () => {
    const { container } = render(<ShareStrip parts={PARTS} label="Where a bill goes" />)

    const segments = [...container.querySelectorAll('[data-share-strip-segment]')]
    expect(segments.map((s) => s.getAttribute('width'))).toEqual(['50%', '30%', '15%', '5%'])
    expect(segments.map((s) => s.getAttribute('x'))).toEqual(['0%', '50%', '80%', '95%'])
    expect(segments[0].getAttribute('class')).toContain('fill-chart-ramp-1')
    expect(segments[1].getAttribute('class')).toContain('fill-chart-ramp-2')
  })

  it('names every part and its percent once, in one label for screen readers', async () => {
    const { container } = render(<ShareStrip parts={PARTS} label="Where a bill goes" />)

    const img = screen.getByRole('img', {
      name: 'Where a bill goes: Schools 50%, City 30%, County 15%, College 5%',
    })
    expect(img).toBeTruthy()
    await expectAccessible(container)
  })

  it('draws nothing when a part has no share', () => {
    const { container } = render(
      <ShareStrip parts={[{ name: 'Schools', percent: 0, tone: 'rust' }]} label="Nothing" />,
    )
    expect(container.firstChild).toBeNull()
  })
})
