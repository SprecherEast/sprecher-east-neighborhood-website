// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { compile } from 'tailwindcss'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Disclosure } from './Disclosure'
import { TOUCH_MIN_HEIGHT } from './layoutSizes'
import { REVEAL_SCROLL_MARGIN } from './scrollMargin'
import { expectAccessible } from './testing/expectAccessible'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const VARIANTS = ['card', 'row', 'bar', 'link'] as const

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

describe('Disclosure, brought into view when opened (#1152)', () => {
  const IN_PAGE = ['card', 'row', 'link'] as const

  /* jsdom has no layout: the scroll is a spy, and the next frame runs when the test says so */
  function setUp(variant: (typeof VARIANTS)[number], defaultOpen = false) {
    const frames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (frame: FrameRequestCallback) => frames.push(frame))
    const { container } = render(
      <Disclosure variant={variant} summary="Question" defaultOpen={defaultOpen}>
        Answer
      </Disclosure>,
    )
    const details = container.querySelector('details') as HTMLDetailsElement
    const scroll = vi.fn()
    details.scrollIntoView = scroll
    const nextFrame = () => frames.splice(0).forEach((frame) => frame(0))
    return { details, scroll, nextFrame }
  }

  it.each(IN_PAGE)(
    'scrolls the opened box to the nearest edge, once it is open (%s)',
    (variant) => {
      const { details, scroll, nextFrame } = setUp(variant)

      fireEvent.click(screen.getByText('Question'))
      expect(scroll).not.toHaveBeenCalled()
      nextFrame()

      expect(details.open).toBe(true)
      expect(scroll).toHaveBeenCalledTimes(1)
      expect(scroll).toHaveBeenCalledWith({ block: 'nearest' })
    },
  )

  it.each(IN_PAGE)(
    'stops clear of the sticky header and leaves a gap under its end (%s)',
    (variant) => {
      const { details } = setUp(variant)

      for (const name of REVEAL_SCROLL_MARGIN.split(' ')) {
        expect(details.classList.contains(name)).toBe(true)
      }
    },
  )

  it('does not scroll when the box closes', () => {
    const { details, scroll, nextFrame } = setUp('card', true)

    fireEvent.click(screen.getByText('Question'))
    nextFrame()

    expect(details.open).toBe(false)
    expect(scroll).not.toHaveBeenCalled()
  })

  it('does not scroll for a box that is open when the page loads', () => {
    const { scroll, nextFrame } = setUp('row', true)

    nextFrame()

    expect(scroll).not.toHaveBeenCalled()
  })

  it('leaves the bar alone: it is already pinned under the site header', () => {
    const { details, scroll, nextFrame } = setUp('bar')

    fireEvent.click(screen.getByText('Question'))
    nextFrame()

    expect(details.open).toBe(true)
    expect(scroll).not.toHaveBeenCalled()
    expect(details.className).not.toContain('scroll-m')
  })
})
