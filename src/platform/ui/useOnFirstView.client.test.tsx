// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useOnFirstView } from './useOnFirstView.client'

type Observed = { callback: IntersectionObserverCallback; disconnected: boolean }

function stubObserver() {
  const made: Observed[] = []
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      private record: Observed
      constructor(callback: IntersectionObserverCallback) {
        this.record = { callback, disconnected: false }
        made.push(this.record)
      }
      observe() {}
      disconnect() {
        this.record.disconnected = true
      }
    },
  )
  return made
}

function Probe({ onView }: { onView: () => void }) {
  const ref = useOnFirstView<HTMLDivElement>(onView)
  return <div ref={ref}>x</div>
}

const enter = (observed: Observed, isIntersecting: boolean) =>
  act(() =>
    observed.callback(
      [{ isIntersecting } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    ),
  )

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('useOnFirstView (#1413)', () => {
  it('does nothing until the element is in view, then runs once and stops watching', () => {
    const made = stubObserver()
    const onView = vi.fn()
    render(<Probe onView={onView} />)
    expect(onView).not.toHaveBeenCalled()
    enter(made[0]!, false)
    expect(onView).not.toHaveBeenCalled()
    enter(made[0]!, true)
    expect(onView).toHaveBeenCalledTimes(1)
    expect(made[0]!.disconnected).toBe(true)
  })

  it('runs the latest callback, not the one from the first render', () => {
    const made = stubObserver()
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = render(<Probe onView={first} />)
    rerender(<Probe onView={second} />)
    enter(made[0]!, true)
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('runs at once when the browser cannot tell what is in view, so nothing goes unseen', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    const onView = vi.fn()
    render(<Probe onView={onView} />)
    expect(onView).toHaveBeenCalledTimes(1)
  })

  it('runs once even where React mounts the element twice and the browser cannot tell', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    const onView = vi.fn()
    render(
      <React.StrictMode>
        <Probe onView={onView} />
      </React.StrictMode>,
    )
    expect(onView).toHaveBeenCalledTimes(1)
  })

  it('stops watching when the element goes away before it was seen', () => {
    const made = stubObserver()
    const onView = vi.fn()
    const { unmount } = render(<Probe onView={onView} />)
    unmount()
    expect(made[0]!.disconnected).toBe(true)
    expect(onView).not.toHaveBeenCalled()
  })
})
