// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { Disclosure } from './Disclosure'
import { TOUCH_MIN_HEIGHT } from './layoutSizes'
import { expectAccessible } from './testing/expectAccessible'

afterEach(cleanup)

const VARIANTS = ['card', 'bar', 'link'] as const

describe('Disclosure', () => {
  it.each(VARIANTS)(
    'is a native details with its summary first, closed by default (%s)',
    (variant) => {
      const { container } = render(
        <Disclosure variant={variant} summary="When is the meeting?">
          Tuesday at 6:30.
        </Disclosure>,
      )
      const details = container.querySelector('details')

      expect(details?.hasAttribute('open')).toBe(false)
      expect(details?.firstElementChild?.tagName).toBe('SUMMARY')
      expect(screen.getByText('When is the meeting?')).toBeTruthy()
      expect(screen.getByText('Tuesday at 6:30.')).toBeTruthy()
    },
  )

  it('opens from the summary, and can start open', () => {
    const { container, rerender } = render(
      <Disclosure variant="card" summary="Question">
        Answer
      </Disclosure>,
    )
    const details = container.querySelector('details') as HTMLDetailsElement

    fireEvent.click(screen.getByText('Question'))
    expect(details.open).toBe(true)

    rerender(
      <Disclosure variant="card" summary="Question" defaultOpen>
        Answer
      </Disclosure>,
    )
    expect(container.querySelector('details')?.hasAttribute('open')).toBe(true)
  })

  it('hides the chevron from screen readers and turns it when open', () => {
    const { container } = render(
      <Disclosure variant="bar" summary="On this page">
        Body
      </Disclosure>,
    )
    const chevron = container.querySelector('summary svg')

    expect(chevron?.getAttribute('aria-hidden')).toBe('true')
    expect(chevron?.getAttribute('class')).toContain('group-open:rotate-180')
  })

  it('gives the caller the details element, to close it (the bar closes when a link is chosen)', () => {
    const ref = React.createRef<HTMLDetailsElement>()
    render(
      <Disclosure ref={ref} variant="bar" summary="On this page" defaultOpen>
        Body
      </Disclosure>,
    )

    ref.current?.removeAttribute('open')
    expect(ref.current?.open).toBe(false)
  })

  it('takes classes for its root and its body', () => {
    const { container } = render(
      <Disclosure variant="bar" summary="S" className="lg:hidden" bodyClassName="max-h-[60svh]">
        <p>Body</p>
      </Disclosure>,
    )

    expect(container.querySelector('details')?.className).toContain('lg:hidden')
    expect(screen.getByText('Body').parentElement?.className).toContain('max-h-[60svh]')
  })

  it.each(VARIANTS)('has no accessibility violations (%s)', async (variant) => {
    const { container } = render(
      <Disclosure variant={variant} summary="Question" defaultOpen>
        <p>Answer</p>
      </Disclosure>,
    )

    await expectAccessible(container)
  })
})

describe('Disclosure, card, as a row to tap (#741)', () => {
  it('has a summary row as tall as a tap needs: 44 px on a phone, 36 px from lg', () => {
    render(
      <Disclosure variant="card" summary="When is the meeting?">
        Tuesday.
      </Disclosure>,
    )

    expect(screen.getByText('When is the meeting?').closest('summary')?.className).toContain(
      TOUCH_MIN_HEIGHT,
    )
  })

  it('the link look has no box: a bare link-coloured row that opens a plain list', () => {
    const { container } = render(
      <Disclosure variant="link" summary="See the smaller pieces">
        List
      </Disclosure>,
    )
    const details = container.querySelector('details') as HTMLElement
    expect(details.className).not.toMatch(/\bborder\b|\bshadow/)
    expect(container.querySelector('summary')?.className).toContain('text-primary-strong')
  })
})
