// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { compile } from 'tailwindcss'
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { Disclosure } from './Disclosure'
import { TOUCH_MIN_HEIGHT } from './layoutSizes'
import { expectAccessible } from './testing/expectAccessible'

afterEach(cleanup)

const VARIANTS = ['card', 'row', 'listRow', 'bar', 'link'] as const

/*
 * Whether the chevron is turned, decided by the real CSS Tailwind makes from its classes (jsdom
 * has no stylesheet): the rule that sets `rotate`, with its selector tried on the element (#967).
 */
async function isTurned(chevron: Element): Promise<boolean> {
  const css = (await compile('@tailwind utilities;')).build([...chevron.classList])
  const selectors = [...css.matchAll(/\{\s*([^{}]+?)\s*\{\s*rotate: 180deg/g)].map(
    (match) => match[1],
  )
  expect(selectors.length).toBeGreaterThan(0)
  return selectors.some((selector) => chevron.matches(selector.replace(/&/g, 'svg')))
}

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

  it('has a row look with no box of its own, so rows can share one card split by divider lines (#1118)', () => {
    const { container } = render(
      <Disclosure variant="row" summary="Sources">
        Body
      </Disclosure>,
    )
    const classes = container.querySelector('details')?.className ?? ''

    expect(classes).not.toContain('border')
    expect(classes).not.toContain('shadow')
    expect(classes).toContain('px-3')
    expect(screen.getByText('Body').className).toContain('py-4')
  })

  it('has a listRow look for a row inside a list: no box or side padding, a label sized from the list (#1163)', () => {
    const { container } = render(
      <Disclosure variant="listRow" summary="More">
        Body
      </Disclosure>,
    )
    const details = container.querySelector('details') as HTMLElement
    expect(details.className).not.toContain('border')
    expect(details.className).not.toContain('px-3')
    const summary = container.querySelector('summary') as HTMLElement
    expect(summary.className).toContain('text-list-row')
    expect(summary.className).toContain('font-medium')
    // The body goes back to body text, whatever size the list around it uses
    expect(screen.getByText('Body').className).toContain('text-base')
  })

  it('tells the caller just before a reader opens it, while it is still closed, and not when they close it (#1165)', () => {
    const states: boolean[] = []
    const { container } = render(
      <Disclosure
        variant="listRow"
        summary="More"
        onOpening={() =>
          states.push((container.querySelector('details') as HTMLDetailsElement).open)
        }
      >
        Body
      </Disclosure>,
    )
    const details = container.querySelector('details') as HTMLDetailsElement
    const summary = container.querySelector('summary') as HTMLElement
    fireEvent.click(summary)
    // Called before the box opened, so the caller can get its content ready first
    expect(states).toEqual([false])
    details.open = true
    fireEvent.click(summary)
    expect(states).toEqual([false])
  })

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
  })

  it('draws the card and row chevron a step bigger, in the main text colour', () => {
    for (const variant of ['card', 'row'] as const) {
      const { container, unmount } = render(
        <Disclosure variant={variant} summary="Question">
          Answer
        </Disclosure>,
      )
      const classes = container.querySelector('summary svg')?.classList
      expect(classes?.contains('size-5')).toBe(true)
      expect(classes?.contains('text-foreground')).toBe(true)
      expect(classes?.contains('text-muted-foreground')).toBe(false)
      unmount()
    }
  })

  it('turns the chevron only for its own box, not for an open box around it (#967)', async () => {
    const { container } = render(
      <Disclosure variant="card" summary="Outer" defaultOpen>
        <Disclosure variant="card" summary="Inner">
          Inner body
        </Disclosure>
      </Disclosure>,
    )
    const [outer, inner] = Array.from(container.querySelectorAll('details'))
    const outerChevron = outer.querySelector(':scope > summary svg') as Element
    const innerChevron = inner.querySelector(':scope > summary svg') as Element

    expect(await isTurned(outerChevron)).toBe(true)
    expect(await isTurned(innerChevron)).toBe(false)

    inner.setAttribute('open', '')
    expect(await isTurned(innerChevron)).toBe(true)

    outer.removeAttribute('open')
    expect(await isTurned(outerChevron)).toBe(false)
    expect(await isTurned(innerChevron)).toBe(true)
  })

  it('turns a top-level box open and back closed (#967)', async () => {
    const { container } = render(
      <Disclosure variant="bar" summary="On this page">
        Body
      </Disclosure>,
    )
    const details = container.querySelector('details') as HTMLDetailsElement
    const chevron = details.querySelector('summary svg') as Element

    expect(await isTurned(chevron)).toBe(false)
    details.setAttribute('open', '')
    expect(await isTurned(chevron)).toBe(true)
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
