// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DISMISSED_BANNERS_KEY } from '@/platform/lib/dismissedBanners'

import { Alert } from './Alert'
import { Dismissible } from './Dismissible.client'
import { expectAccessible } from './testing/expectAccessible'

beforeEach(() => localStorage.clear())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function setup(props: Partial<React.ComponentProps<typeof Dismissible>> = {}) {
  return render(
    <>
      <Dismissible id="meeting" {...props}>
        <Alert tone="info" live={false}>
          WisDOT meets on Nov 10
        </Alert>
      </Dismissible>
      <p tabIndex={-1}>Article text</p>
    </>,
  )
}

describe('Dismissible', () => {
  it('shows the notice with a close button that has a name', () => {
    setup()

    expect(screen.getByText('WisDOT meets on Nov 10')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Close this notice' })).toBeTruthy()
  })

  it('hides the notice when closed, remembers it, and moves focus to the content after it', async () => {
    setup()

    await userEvent.click(screen.getByRole('button', { name: 'Close this notice' }))

    expect(screen.queryByText('WisDOT meets on Nov 10')).toBeNull()
    expect(JSON.parse(localStorage.getItem(DISMISSED_BANNERS_KEY) ?? '[]')).toEqual(['meeting'])
    expect(document.activeElement).toBe(screen.getByText('Article text'))
  })

  it('closes with the keyboard', async () => {
    setup()
    const user = userEvent.setup()

    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close this notice' }))
    await user.keyboard('{Enter}')

    expect(screen.queryByText('WisDOT meets on Nov 10')).toBeNull()
  })

  it('stays hidden on the next visit', () => {
    localStorage.setItem(DISMISSED_BANNERS_KEY, JSON.stringify(['meeting']))
    setup()

    expect(screen.queryByText('WisDOT meets on Nov 10')).toBeNull()
  })

  it('still shows when storage is blocked, and closes for this visit', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    setup()

    await userEvent.click(screen.getByRole('button', { name: 'Close this notice' }))

    expect(screen.queryByText('WisDOT meets on Nov 10')).toBeNull()
  })

  it('goes away once its end time passes, even on a page cached before that', () => {
    vi.useFakeTimers({ now: new Date('2026-11-10T23:29:00Z') })
    setup({ showUntil: '2026-11-10T23:30:00.000Z' })
    expect(screen.getByText('WisDOT meets on Nov 10')).toBeTruthy()

    act(() => {
      vi.advanceTimersByTime(90_000)
    })

    expect(screen.queryByText('WisDOT meets on Nov 10')).toBeNull()
  })

  it('has no accessibility violations, open', async () => {
    const { container } = setup()
    await expectAccessible(container)
  })
})
