// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Disclosure, type DisclosureProps } from './Disclosure'
import { REVEAL_SCROLL_MARGIN } from './scrollMargin'

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
