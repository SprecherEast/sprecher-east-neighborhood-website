// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import type { SectionAlign, SectionPhoneOrder, SectionVerticalAlign } from '../domain/blocks'
import { SECTION_GAP } from './blockStyles'
import { SectionBlock } from './SectionBlock'

afterEach(cleanup)

type Item = Parameters<typeof SectionBlock>[0]['items'][number]
const item = (text: string, overrides: Partial<Item> = {}): Item => ({
  width: 'full',
  align: 'start' as SectionAlign,
  verticalAlign: 'top' as SectionVerticalAlign,
  phoneOrder: 'inOrder' as SectionPhoneOrder,
  children: <p>{text}</p>,
  ...overrides,
})
const cell = (text: string) => screen.getByText(text).parentElement as HTMLElement

describe('SectionBlock (#884)', () => {
  it('draws each item’s content, in the order listed', async () => {
    const { container } = render(
      <SectionBlock items={[item('First'), item('Second', { width: 'half' })]} />,
    )
    const paragraphs = [...container.querySelectorAll('p')].map((p) => p.textContent)
    expect(paragraphs).toEqual(['First', 'Second'])
    await expectAccessible(container)
  })

  it('stacks items on a phone and sets each one’s width on the 12-column grid from lg up', () => {
    render(
      <SectionBlock
        items={[
          item('a', { width: 'threeQuarters' }),
          item('b', { width: 'twoThirds' }),
          item('c', { width: 'half' }),
          item('d', { width: 'oneThird' }),
          item('e', { width: 'quarter' }),
          item('f', { width: 'full' }),
        ]}
      />,
    )
    const span = (t: string) => cell(t).className
    expect(span('a')).toContain('col-span-4 lg:col-span-9')
    expect(span('b')).toContain('lg:col-span-8')
    expect(span('c')).toContain('lg:col-span-6')
    expect(span('d')).toContain('lg:col-span-4')
    expect(span('e')).toContain('lg:col-span-3')
    expect(span('f')).toContain('lg:col-span-12')
  })

  it('lines text up and sits an item at the top, middle or bottom of its row', () => {
    render(
      <SectionBlock
        items={[
          item('a', { align: 'center', verticalAlign: 'center' }),
          item('b', { align: 'end', verticalAlign: 'bottom' }),
          item('c'),
        ]}
      />,
    )
    expect(cell('a').className).toContain('text-center')
    expect(cell('a').className).toContain('self-center')
    expect(cell('b').className).toContain('text-end')
    expect(cell('b').className).toContain('self-end')
    expect(cell('c').className).toContain('text-start')
    expect(cell('c').className).toContain('self-start')
  })

  it('moves an item above or below the rest on a phone only, with the DOM order unchanged', () => {
    const { container } = render(
      <SectionBlock
        items={[
          item('text'),
          item('picture', { phoneOrder: 'first' }),
          item('note', { phoneOrder: 'last' }),
        ]}
      />,
    )
    expect(cell('picture').className).toContain('order-first lg:order-none')
    expect(cell('note').className).toContain('order-last lg:order-none')
    expect(cell('text').className).not.toMatch(/order-(first|last)/)
    expect([...container.querySelectorAll('p')].map((p) => p.textContent)).toEqual([
      'text',
      'picture',
      'note',
    ])
  })

  it('draws nothing without items', () => {
    const { container } = render(<SectionBlock items={[]} />)
    expect(container.firstChild).toBeNull()
  })

  // Blocks stacked in one item are separated by the section's own gap (#891)
  it('spaces blocks stacked in one item evenly', () => {
    render(
      <SectionBlock
        items={[
          item('x', {
            children: (
              <>
                <p>First block</p>
                <p>Second block</p>
              </>
            ),
          }),
        ]}
      />,
    )
    const stack = cell('First block')
    expect(stack.className).toMatch(/\bflex\b/)
    expect(stack.className).toMatch(/\bflex-col\b/)
    expect(stack.className).toContain(SECTION_GAP)
  })
})
