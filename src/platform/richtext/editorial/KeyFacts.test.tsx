// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import { KeyFacts } from './KeyFacts'
import { KEY_FACT_LIMITS } from './keyFactsBlockConfig'
import type { KeyFact } from './keyFacts'

afterEach(cleanup)

const FACTS: KeyFact[] = [
  {
    value: '2040s',
    label: 'earliest construction',
    detail: null,
    icon: 'date',
    certainty: 'estimate',
    source: null,
  },
  {
    value: '?',
    label: 'total cost',
    detail: 'No price has been published.',
    icon: 'money',
    certainty: 'unknown',
    source: null,
  },
  {
    value: 'None',
    label: 'tax increase verified',
    detail: null,
    icon: 'taxes',
    certainty: 'confirmed',
    source: {
      href: 'https://example.com',
      label: 'City budget',
      external: true,
      appearance: 'default',
    },
  },
]

describe('KeyFacts', () => {
  it('shows each fact with its label, value and certainty in words', async () => {
    const { container } = render(<KeyFacts facts={FACTS} />)

    const items = within(screen.getAllByRole('list')[0]).getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(within(items[0]).getByText('2040s')).toBeTruthy()
    expect(within(items[0]).getByText('earliest construction')).toBeTruthy()
    expect(within(items[0]).getByText('Estimate')).toBeTruthy()
    expect(within(items[1]).getByText('Unknown')).toBeTruthy()
    expect(within(items[2]).getByText('Confirmed')).toBeTruthy()
    expect(within(items[2]).getByRole('link', { name: /City budget/ })).toBeTruthy()
    await expectAccessible(container)
  })

  it('puts exactly three facts three across from sm, two or four in two columns', () => {
    const { container, rerender } = render(<KeyFacts facts={FACTS} />)
    expect(container.querySelector('ul')?.className).toContain('sm:grid-cols-3')
    expect(container.querySelector('ul')?.getAttribute('role')).toBe('list')

    rerender(<KeyFacts facts={FACTS.slice(0, 2)} />)
    expect(container.querySelector('ul')?.className).not.toMatch(/grid-cols-3/)
  })

  it('puts the icon and the label on one row, before the value', async () => {
    const { container } = render(<KeyFacts facts={FACTS.slice(0, 1)} />)
    const term = container.querySelector('dt') as HTMLElement
    const definition = container.querySelector('dd') as HTMLElement
    const icon = container.querySelector('svg') as SVGElement

    // The icon is decorative and shares the label's row (the term), above the value
    expect(icon.getAttribute('aria-hidden')).toBe('true')
    expect(icon.getAttribute('class')).toContain('size-5')
    expect(term.contains(icon)).toBe(true)
    expect(term.contains(definition)).toBe(false)
    expect(term.className).toContain('items-start')

    // Reading order: the label comes before the value
    expect(term.compareDocumentPosition(definition) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(term.textContent).toBe('earliest construction')
    await expectAccessible(container)
  })

  it('leads with the label in bold body-size text, not the small grey line it used to be', () => {
    const { container } = render(<KeyFacts facts={FACTS.slice(0, 1)} />)
    const term = container.querySelector('dt') as HTMLElement

    expect(term.className).toContain('text-base')
    expect(term.className).toContain('font-semibold')
    expect(term.className).toContain('text-foreground')
    expect(term.className).not.toContain('text-sm')
    expect(term.className).not.toContain('text-muted-foreground')
  })

  it('keeps the value the biggest text on the card, above the explanation', () => {
    const { container } = render(<KeyFacts facts={FACTS.slice(1, 2)} />)
    const [value, detail] = Array.from(container.querySelectorAll('dd')) as HTMLElement[]

    expect(value.textContent).toBe('?')
    expect(value.className).toContain('text-2xl')
    expect(value.className).toContain('font-bold')
    expect(detail.textContent).toBe('No price has been published.')
    expect(detail.className).toContain('text-sm')
    expect(detail.className).toContain('text-muted-foreground')
    expect(value.compareDocumentPosition(detail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('shows the same order on screen as screen readers hear: no reversed column', () => {
    const { container } = render(<KeyFacts facts={FACTS.slice(1, 2)} />)
    expect(container.querySelector('dl')?.className).not.toContain('flex-col-reverse')
  })

  it('leaves out the explanation, and its gap, when a fact has none', async () => {
    const { container } = render(<KeyFacts facts={FACTS.slice(0, 1)} />)

    expect(container.querySelectorAll('dd')).toHaveLength(1)
    await expectAccessible(container)
  })

  it('puts the certainty and the source after the explanation', () => {
    const { container } = render(<KeyFacts facts={FACTS.slice(1, 3)} />)
    const [first, second] = Array.from(container.querySelectorAll('li')) as HTMLElement[]
    const detail = within(first).getByText('No price has been published.')
    const certainty = within(first).getByText('Unknown')
    const link = within(second).getByRole('link', { name: /City budget/ })

    expect(
      detail.compareDocumentPosition(certainty) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      within(second).getByText('Confirmed').compareDocumentPosition(link) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('wraps the longest allowed label inside the card', async () => {
    const label = 'a'.repeat(KEY_FACT_LIMITS.label)
    const { container } = render(<KeyFacts facts={[{ ...FACTS[0], label }, FACTS[1]]} />)
    const term = container.querySelector('dt') as HTMLElement
    expect(term.textContent).toBe(label)
    const text = within(term).getByText(label)
    expect(text.className).toContain('min-w-0')
    expect(text.className).toContain('[overflow-wrap:anywhere]')
    await expectAccessible(container)
  })

  it('renders nothing without facts', () => {
    const { container } = render(<KeyFacts facts={[]} />)
    expect(container.innerHTML).toBe('')
  })
})
