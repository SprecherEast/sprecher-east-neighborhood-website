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

  it('as a tab face on a phone: keeps the icon and the value, and reads the rest to screen readers only (#704)', () => {
    const { container } = render(<FactCard fact={FACT} variant="tab" />)
    const hidden = (text: string) => {
      const part = [...container.querySelectorAll('span')].find(
        (span) => span.textContent === text && span.children.length === 0,
      )
      return part?.className ?? ''
    }
    // Still in the page for a screen reader, which names the tab from its content
    expect(hidden('Day-to-day money')).toContain('max-sm:sr-only')
    expect(container.querySelector('[data-fact-part="foot"]')?.className).toContain(
      'max-sm:sr-only',
    )
    // The value stays, and nothing hides the icon
    expect(hidden('$477.5M')).not.toContain('sr-only')
    expect(container.querySelector('svg')?.getAttribute('class')).not.toContain('sr-only')
  })

  it('as a tab face: has the same parts whether or not the fact has an explanation, so no tab is taller or fuller than the rest (#707)', () => {
    const withDetail: KeyFact = { ...FACT, detail: 'The City’s release says about $7 a month' }
    const plain = render(<FactCard fact={FACT} variant="tab" />).container
    const detailed = render(<FactCard fact={withDetail} variant="tab" />).container
    expect(detailed.textContent).not.toContain('The City’s release')
    const parts = (c: HTMLElement) =>
      [...c.querySelectorAll('*')].map((e) => e.tagName + (e.getAttribute('data-fact-part') ?? ''))
    expect(parts(detailed)).toEqual(parts(plain))
  })

  it('as a card: still shows the explanation', () => {
    const withDetail: KeyFact = { ...FACT, detail: 'The City’s release says about $7 a month' }
    const { container } = render(<FactCard fact={withDetail} />)
    expect(container.textContent).toContain('The City’s release says about $7 a month')
  })

  it('as a tab face: keeps the last two words of the figure together (#707)', () => {
    const { container } = render(
      <FactCard fact={{ ...FACT, value: '+$90 a year' }} variant="tab" />,
    )
    expect(container.querySelector('[data-fact-part="value"]')?.textContent).toBe(
      '+$90 a\u00a0year',
    )
  })

  it('as a tab face: the figure steps down for narrow phones, so it never breaks across lines (#704)', () => {
    const { container } = render(<FactCard fact={FACT} variant="tab" />)
    const value = container.querySelector('[data-fact-part="value"]')
    for (const size of ['text-xs', 'min-[360px]:text-sm', 'min-[400px]:text-base', 'sm:text-2xl']) {
      expect(value?.className).toContain(size)
    }
  })

  it('as a card: nothing is hidden on a phone', () => {
    const { container } = render(<FactCard fact={FACT} />)
    expect(container.innerHTML).not.toContain('max-sm:sr-only')
  })
})
