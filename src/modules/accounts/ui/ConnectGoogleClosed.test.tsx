// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import { ConnectGoogleClosed } from './ConnectGoogleClosed'

afterEach(cleanup)

describe('ConnectGoogleClosed', () => {
  it('says the one fixed message, announced, with the way back to log in', async () => {
    const { container } = render(
      <main>
        <ConnectGoogleClosed />
      </main>,
    )
    expect(screen.getByRole('alert').textContent).toBe(
      'We couldn’t connect Google. Please start again with “Continue with Google”.',
    )
    expect(screen.getByRole('link', { name: 'Back to Log In' }).getAttribute('href')).toBe('/login')
    await expectAccessible(container)
  })
})
