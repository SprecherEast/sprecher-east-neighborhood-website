// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

const mocks = vi.hoisted(() => ({ signOut: vi.fn(), push: vi.fn(), refresh: vi.fn() }))
vi.mock('../actions', () => ({ signOut: mocks.signOut }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}))

import { LogInAgainButton } from './LogInAgainButton.client'

beforeEach(() => {
  for (const fn of Object.values(mocks)) fn.mockReset()
})
afterEach(cleanup)

describe('LogInAgainButton', () => {
  it('signs out, then opens the log in page', async () => {
    mocks.signOut.mockResolvedValue(undefined)
    const { container } = render(<LogInAgainButton />)
    await expectAccessible(container)
    await userEvent.click(screen.getByRole('button', { name: 'Log in again' }))
    expect(mocks.signOut).toHaveBeenCalledOnce()
    expect(mocks.push).toHaveBeenCalledWith('/login')
    expect(mocks.refresh).toHaveBeenCalled()
  })

  it('tells the card when signing out got no answer, and stays on the page', async () => {
    mocks.signOut.mockRejectedValue(new Error('network'))
    const onFailed = vi.fn()
    render(<LogInAgainButton onFailed={onFailed} />)
    await userEvent.click(screen.getByRole('button', { name: 'Log in again' }))
    expect(onFailed).toHaveBeenCalledOnce()
    expect(mocks.push).not.toHaveBeenCalled()
  })
})
