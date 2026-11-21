// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { VersionCheck } from './VersionCheck.client'

const answer = (buildId: string) =>
  Promise.resolve({ ok: true, json: () => Promise.resolve({ buildId }) } as Response)

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
  // The check only runs in a visible tab
  Object.defineProperty(document, 'hidden', { value: false, configurable: true })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

/** The site's first answer is the baseline; the second one, 30 s later, is a newer build */
const showNewBuild = async () => {
  const fetchMock = vi
    .fn()
    .mockImplementationOnce(() => answer('a'))
    .mockImplementation(() => answer('b'))
  vi.stubGlobal('fetch', fetchMock)
  render(<VersionCheck />)
  await act(async () => {})
  await poll()
}

/** The check runs every 30 s, and only while the reader has been active in the last 30 s */
const poll = async () => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(20_000)
  })
  document.dispatchEvent(new Event('keydown'))
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10_000)
  })
  // The notice slides in on the next frame
  await act(async () => {
    await vi.advanceTimersByTimeAsync(100)
  })
}

describe('VersionCheck', () => {
  it('offers a refresh when a newer build is out, and keeps offering it until the reader closes it', async () => {
    await showNewBuild()
    expect(screen.getByText('New version available')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeTruthy()

    // A reader who looked away for a minute still sees it
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    expect(screen.getByText('New version available')).toBeTruthy()
  })

  it('closes when the reader closes it, and does not offer that build again', async () => {
    await showNewBuild()
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss update notification' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400)
    })
    expect(screen.queryByText('New version available')).toBeNull()
    await poll()
    expect(screen.queryByText('New version available')).toBeNull()
  })
})
