// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import { KeyFacts } from './KeyFacts'
import type { KeyFact } from './keyFacts'

afterEach(cleanup)

const FACTS: KeyFact[] = [
  {
    value: '2040s',
    label: 'earliest construction',
    icon: 'date',
    certainty: 'estimate',
    source: null,
  },
  { value: '?', label: 'total cost', icon: 'money', certainty: 'unknown', source: null },
  {
    value: 'None',
    label: 'tax increase verified',
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

  it('wraps the longest allowed label (60 characters) inside the card', async () => {
    const label = 'a'.repeat(60)
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
