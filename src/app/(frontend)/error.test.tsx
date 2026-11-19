// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import ErrorPage from './error'

afterEach(cleanup)

describe('the public site’s error page', () => {
  it('says something went wrong, without the error’s text, and retries on request', async () => {
    const retry = vi.fn()
    const { container } = render(
      <ErrorPage error={new Error('Failed query: params ada@example.com')} retry={retry} />,
    )

    expect(screen.getByText(/something went wrong on our side/i)).toBeTruthy()
    expect(container.textContent).not.toContain('ada@example.com')
    await userEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(retry).toHaveBeenCalledOnce()
    await expectAccessible(container)
  })
})
