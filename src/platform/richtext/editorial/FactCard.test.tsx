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

  it('as a tab face: the label is the only thing drawn, in phrasing elements with no icon, card or link (#1112)', () => {
    const { container } = render(<FactCard fact={FACT} variant="tab" />)
    const label = container.querySelector('[data-fact-part="label"]')
    expect(label?.textContent).toBe('Day-to-day money')
    expect(label?.className).not.toContain('sr-only')
    expect(container.querySelector('svg, dl, dt, dd, a, div, button')).toBeNull()
    expect(container.querySelector('[data-fact-part="value"], [data-fact-part="foot"]')).toBeNull()
  })

  it('as a tab face: screen readers still hear the figure and how sure we are after the label', () => {
    const { container } = render(<FactCard fact={FACT} variant="tab" />)
    const spoken = container.querySelector('[data-fact-part="spoken"]')
    expect(spoken?.className).toContain('sr-only')
    expect(spoken?.textContent).toContain('$477.5M')
    expect(spoken?.textContent).toContain('Confirmed')
    const text = container.textContent ?? ''
    expect(text.indexOf('Day-to-day money')).toBeLessThan(text.indexOf('$477.5M'))
  })

  it('as a tab face: has the same parts whether or not the fact has an explanation, and never shows it', () => {
    const withDetail: KeyFact = { ...FACT, detail: 'The City’s release says about $7 a month' }
    const plain = render(<FactCard fact={FACT} variant="tab" />).container
    const detailed = render(<FactCard fact={withDetail} variant="tab" />).container
    expect(detailed.textContent).not.toContain('The City’s release')
    const parts = (c: HTMLElement) =>
      [...c.querySelectorAll('*')].map((e) => e.tagName + (e.getAttribute('data-fact-part') ?? ''))
    expect(parts(detailed)).toEqual(parts(plain))
  })

  it('as a card: marks its value and foot, for the browser tests that line them up (#678)', () => {
    const { container } = render(<FactCard fact={FACT} />)
    expect(container.querySelector('dd[data-fact-part="value"]')?.textContent).toBe('$477.5M')
    expect(container.querySelector('[data-fact-part="foot"]')).not.toBeNull()
  })

  it('as a card: still shows the explanation', () => {
    const withDetail: KeyFact = { ...FACT, detail: 'The City’s release says about $7 a month' }
    const { container } = render(<FactCard fact={withDetail} />)
    expect(container.textContent).toContain('The City’s release says about $7 a month')
  })

  it('as a card: nothing is hidden on a phone', () => {
    const { container } = render(<FactCard fact={FACT} />)
    expect(container.innerHTML).not.toContain('max-sm:sr-only')
  })
})
