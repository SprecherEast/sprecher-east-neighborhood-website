// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Disclosure, type DisclosureProps } from './Disclosure'
import { REVEAL_PEEK_VAR, REVEAL_SCROLL_MARGIN } from './scrollMargin'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Disclosure, brought into view when opened (#1152)', () => {
  const IN_PAGE = ['card', 'row', 'link'] as const

  /* jsdom has no layout: the scroll is a spy, and the next frame runs when the test says so */
  function setUp(variant: DisclosureProps['variant'], defaultOpen = false) {
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

describe('Disclosure, showing the header of the next box when opened (#1154)', () => {
  /* jsdom has no layout, so each box is given the place it would have on screen */
  const place = (element: Element, top: number, bottom: number) => {
    element.getBoundingClientRect = () => ({ top, bottom, height: bottom - top }) as DOMRect
  }

  function setUp(boxes: number) {
    const frames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (frame: FrameRequestCallback) => frames.push(frame))
    const { container } = render(
      <div>
        {Array.from({ length: boxes }, (_, index) => (
          <Disclosure key={index} variant="row" summary={`Row ${index + 1}`}>
            Body
          </Disclosure>
        ))}
        <p>After the rows</p>
      </div>,
    )
    const all = Array.from(container.querySelectorAll('details'))
    const scrolls: string[] = []
    for (const details of all) {
      // What the room for the next box was at the moment the browser was asked to scroll
      details.scrollIntoView = () => scrolls.push(details.style.getPropertyValue(REVEAL_PEEK_VAR))
    }
    const open = (index: number) => {
      fireEvent.click(screen.getByText(`Row ${index + 1}`))
      frames.splice(0).forEach((frame) => frame(0))
    }
    return { all, scrolls, open }
  }

  it('keeps room under the opened box for the next header row and half a row more', () => {
    const { all, scrolls, open } = setUp(2)
    place(all[0], 100, 600)
    place(all[1].querySelector('summary') as Element, 601, 645)

    open(0)

    // From the box's end to the end of the next header (45), plus half that header (22)
    expect(scrolls).toEqual(['67px'])
  })

  it('keeps no extra room when nothing opens under it', () => {
    const { all, scrolls, open } = setUp(2)
    place(all[1], 100, 600)

    open(1)

    expect(scrolls).toEqual([''])
  })

  it('measures again each time, so a box that lost its neighbour stops keeping room', () => {
    const { all, scrolls, open } = setUp(2)
    place(all[0], 100, 600)
    place(all[1].querySelector('summary') as Element, 601, 645)
    open(0)
    open(0)
    all[1].remove()

    open(0)

    expect(scrolls).toEqual(['67px', ''])
  })
})
