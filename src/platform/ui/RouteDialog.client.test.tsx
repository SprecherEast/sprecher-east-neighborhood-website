// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RouteDialog } from './RouteDialog.client'
import { expectAccessible } from './testing/expectAccessible'

const back = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ back }) }))

afterEach(() => {
  cleanup()
  back.mockClear()
})

describe('RouteDialog', () => {
  it('opens already, named, with its content, and is accessible', async () => {
    render(
      <RouteDialog title="One issue" backLabel="Back to our plan">
        <p>What it says</p>
      </RouteDialog>,
    )

    expect(screen.getByRole('dialog', { name: 'One issue' })).toBeTruthy()
    expect(screen.getByText('What it says')).toBeTruthy()
    await expectAccessible(document.body)
  })

  it('goes back one step with the close button, the back button and Escape', async () => {
    render(
      <RouteDialog title="One issue" backLabel="Back to our plan">
        <p>What it says</p>
      </RouteDialog>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    await userEvent.click(screen.getByRole('button', { name: 'Back to our plan' }))
    await userEvent.keyboard('{Escape}')

    expect(back).toHaveBeenCalledTimes(3)
  })
})
