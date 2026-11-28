// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ decideConnectionForm: vi.fn() }))
vi.mock('../actions', () => ({ decideConnectionForm: mocks.decideConnectionForm }))

import { ConsentButtons } from './ConsentButtons.client'
import { ConsentCard } from './ConsentCard'

const input = {
  request: {
    clientId: 'mcp_a',
    redirectUri: 'https://claude.ai/cb',
    state: 's',
    codeChallenge: 'c'.repeat(43),
    resource: 'https://example.com/api/mcp',
    scope: 'read',
  },
  ticket: '123.abc',
}
const view = { ...input, clientName: 'Claude', redirectHost: 'claude.ai', agentName: 'Scout' }

beforeEach(() => mocks.decideConnectionForm.mockReset().mockResolvedValue({ message: 'Refused.' }))
afterEach(cleanup)

/** What the action received: its bound input, the earlier answer and the form's fields */
const lastCall = () => {
  const [bound, , form] = mocks.decideConnectionForm.mock.lastCall ?? []
  return { bound, choice: (form as FormData).get('decision') }
}
/** The card binds the request and ticket once, on the server, and hands the buttons the action */
const card = () => render(<ConsentCard view={view} />)

describe('ConsentButtons in the approval card', () => {
  it('sends the request and its ticket with the choice of the pressed button', async () => {
    card()
    await userEvent.click(screen.getByRole('button', { name: 'Allow this connection' }))
    expect(lastCall()).toEqual({ bound: input, choice: 'approve' })
    await userEvent.click(screen.getByRole('button', { name: 'Don’t allow' }))
    expect(lastCall()).toEqual({ bound: input, choice: 'deny' })
  })

  it('is a form that submits each button, so it needs no script to work', () => {
    card()
    for (const name of ['Allow this connection', 'Don’t allow']) {
      const button = screen.getByRole('button', { name })
      expect(button.getAttribute('type')).toBe('submit')
      expect(button.closest('form')).not.toBeNull()
    }
  })

  it('shows a refusal where the buttons are', async () => {
    card()
    await userEvent.click(screen.getByRole('button', { name: 'Allow this connection' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Refused.'))
  })
})

describe('ConsentButtons', () => {
  it('takes its action bound, and never binds one itself', async () => {
    const action = vi.fn().mockResolvedValue({ message: 'Refused.' })
    render(<ConsentButtons action={action} />)
    await userEvent.click(screen.getByRole('button', { name: 'Allow this connection' }))
    expect(action).toHaveBeenCalledOnce()
    expect(mocks.decideConnectionForm).not.toHaveBeenCalled()
  })
})
