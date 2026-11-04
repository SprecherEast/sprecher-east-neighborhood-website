// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import { FactCard } from './FactCard'
import type { KeyFact } from './keyFacts'

afterEach(cleanup)

const FACT: KeyFact = {
  value: '$477.5M',
  label: 'Day-to-day money',
  icon: 'money',
  detail: null,
  certainty: 'confirmed',
  source: {
    href: 'https://example.com',
    label: 'City budget',
    external: true,
    appearance: 'default',
  },
}

describe('FactCard', () => {
  it('is a card with a term list and a source link by default', async () => {
    const { container } = render(<FactCard fact={FACT} />)
    expect(container.querySelector('dl dt')?.textContent).toBe('Day-to-day money')
    expect(container.querySelector('dl dd')?.textContent).toBe('$477.5M')
    expect(screen.getByRole('link', { name: /City budget/ })).toBeTruthy()
    await expectAccessible(container)
  })

  it('as a tab face: the same words in phrasing elements, with no card and no link', () => {
    const { container } = render(<FactCard fact={FACT} variant="tab" />)
    expect(container.textContent).toContain('Day-to-day money')
    expect(container.textContent).toContain('$477.5M')
    expect(container.textContent).toContain('Confirmed')
    expect(container.querySelector('dl, dt, dd, a, div, button')).toBeNull()
  })

  it('reads the label before the value in a tab too', () => {
    const { container } = render(<FactCard fact={FACT} variant="tab" />)
    const text = container.textContent ?? ''
    expect(text.indexOf('Day-to-day money')).toBeLessThan(text.indexOf('$477.5M'))
  })
})
