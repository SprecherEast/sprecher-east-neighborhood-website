// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ALERT_TONE_CLASSES, type AlertTone } from './Alert'
import { Button } from './Button'
import { Toast } from './Toast.client'
import { expectAccessible } from './testing/expectAccessible'

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const TONES: AlertTone[] = ['info', 'success', 'warning', 'error']
/** The toast itself (Radix draws it as a list item in the viewport) */
const toast = () => screen.getByRole('listitem')

describe('Toast', () => {
  it('shows its message with an optional title, and offers an action (#434)', async () => {
    // The accessibility check waits on real timers
    vi.useRealTimers()
    const { container } = render(
      <Toast
        title="Heads up"
        message="New version available"
        action={<Button size="sm">Refresh</Button>}
        onDismiss={() => {}}
      />,
    )

    expect(toast().textContent).toContain('Heads up')
    expect(toast().textContent).toContain('New version available')
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeTruthy()
    await expectAccessible(container)
  })

  it('is announced politely, and an error interrupts', () => {
    const { unmount } = render(<Toast message="Saved" tone="success" onDismiss={() => {}} />)
    // Screen readers are told a moment after it appears, in a region of their own
    act(() => void vi.advanceTimersByTime(100))
    expect(document.querySelector('[role="status"][aria-live="polite"]')?.textContent).toContain(
      'Saved',
    )
    unmount()
    render(<Toast message="Could not save" tone="error" onDismiss={() => {}} />)
    act(() => void vi.advanceTimersByTime(100))
    expect(document.querySelector('[role="status"][aria-live="assertive"]')?.textContent).toContain(
      'Could not save',
    )
  })

  it.each(TONES)('draws the %s tone with the Alert’s colours and its own icon', (tone) => {
    render(<Toast message="Message" tone={tone} onDismiss={() => {}} />)
    const surface = toast().firstElementChild as HTMLElement
    for (const name of ALERT_TONE_CLASSES[tone].split(' ')) {
      expect(surface.classList.contains(name)).toBe(true)
    }
    expect(surface.querySelector('svg')).not.toBeNull()
  })

  it('keeps the neutral look when no tone is given', () => {
    render(<Toast message="Saved" onDismiss={() => {}} />)
    expect((toast().firstElementChild as HTMLElement).className).toContain('border-border')
  })

  describe('ending: fade (the default)', () => {
    it('closes by itself after 5 seconds, saying it faded', () => {
      const onDismiss = vi.fn()
      render(<Toast message="Saved" onDismiss={onDismiss} />)
      act(() => void vi.advanceTimersByTime(4900))
      expect(onDismiss).not.toHaveBeenCalled()
      act(() => void vi.advanceTimersByTime(200))
      expect(onDismiss).toHaveBeenCalledWith('fade')
    })

    it('fades after the time it is given', () => {
      const onDismiss = vi.fn()
      render(<Toast message="Saved" durationMs={1500} onDismiss={onDismiss} />)
      act(() => void vi.advanceTimersByTime(1600))
      expect(onDismiss).toHaveBeenCalledWith('fade')
    })

    it('waits while the reader points at it', () => {
      const onDismiss = vi.fn()
      render(<Toast message="Saved" durationMs={1000} onDismiss={onDismiss} />)
      fireEvent.pointerMove(screen.getByRole('region'))
      act(() => void vi.advanceTimersByTime(5000))
      expect(onDismiss).not.toHaveBeenCalled()
    })

    it('waits while focus is in it', () => {
      const onDismiss = vi.fn()
      render(<Toast message="Saved" durationMs={1000} onDismiss={onDismiss} />)
      fireEvent.focusIn(screen.getByRole('button', { name: 'Dismiss' }))
      act(() => void vi.advanceTimersByTime(5000))
      expect(onDismiss).not.toHaveBeenCalled()
    })

    it('has a close button, named for screen readers', () => {
      const onDismiss = vi.fn()
      render(<Toast message="Saved" onDismiss={onDismiss} dismissLabel="Dismiss the notice" />)
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss the notice' }))
      expect(onDismiss).toHaveBeenCalledWith('close')
    })
  })

  describe('ending: close', () => {
    it('stays until the reader closes it', () => {
      const onDismiss = vi.fn()
      render(<Toast message="Heads up" ending="close" onDismiss={onDismiss} />)
      act(() => void vi.advanceTimersByTime(60_000))
      expect(onDismiss).not.toHaveBeenCalled()
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
      expect(onDismiss).toHaveBeenCalledWith('close')
    })
  })

  describe('ending: accept', () => {
    it('stays until the reader accepts, with its own button and no other way out', () => {
      const onDismiss = vi.fn()
      const onAccept = vi.fn()
      render(
        <Toast
          message="We use 2026 rates"
          ending="accept"
          acceptLabel="Got it"
          onAccept={onAccept}
          onDismiss={onDismiss}
        />,
      )
      act(() => void vi.advanceTimersByTime(60_000))
      expect(onDismiss).not.toHaveBeenCalled()
      // No separate close button: only accepting leaves it
      expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull()
      // Neither Escape nor a swipe counts as accepting
      fireEvent.keyDown(toast(), { key: 'Escape' })
      expect(onDismiss).not.toHaveBeenCalled()
      fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
      expect(onAccept).toHaveBeenCalledOnce()
      expect(onDismiss).toHaveBeenCalledWith('accept')
    })
  })

  describe('placement', () => {
    it('sits at the bottom of the screen by default, as it always has', () => {
      render(<Toast message="Saved" onDismiss={() => {}} />)
      expect(screen.getByRole('list').className).toContain('fixed')
    })

    it('can sit over the top edge of the panel it is in, not fixed to the screen', () => {
      render(<Toast message="Saved" placement="panel" onDismiss={() => {}} />)
      const viewport = screen.getByRole('list')
      expect(viewport.className).toContain('absolute')
      expect(viewport.className).not.toContain('fixed')
    })
  })

  describe('motion', () => {
    it('is closed while it is not visible', () => {
      render(<Toast message="Saved" onDismiss={() => {}} visible={false} />)
      expect(screen.queryByRole('listitem')).toBeNull()
    })

    it('slides with the theme’s own motion, which a reader who asked for less never gets', () => {
      render(<Toast message="Saved" onDismiss={() => {}} />)
      expect(toast().className).toContain('toast-motion')
    })
  })
})
