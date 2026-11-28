// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ decideConnectionForm: vi.fn() }))
vi.mock('../actions', () => ({ decideConnectionForm: mocks.decideConnectionForm }))

import { ConsentButtons } from './ConsentButtons.client'

const view = {
  request: {
    clientId: 'mcp_a',
    redirectUri: 'https://claude.ai/cb',
    state: 's',
    codeChallenge: 'c'.repeat(43),
    resource: 'https://example.com/api/mcp',
    scope: 'mcp',
  },
  ticket: '123.abc',
}

beforeEach(() => mocks.decideConnectionForm.mockReset().mockResolvedValue({ message: 'Refused.' }))
afterEach(cleanup)

/** What the action received: the bound input, the earlier answer and the form's fields */
const lastCall = () => {
  const [input, , form] = mocks.decideConnectionForm.mock.lastCall ?? []
  return { input, choice: (form as FormData).get('decision') }
}

describe('ConsentButtons', () => {
  it('sends the request and its ticket with the choice of the pressed button', async () => {
    render(<ConsentButtons view={view} />)
    await userEvent.click(screen.getByRole('button', { name: 'Allow this connection' }))
    expect(lastCall()).toEqual({ input: view, choice: 'approve' })
    await userEvent.click(screen.getByRole('button', { name: 'Don’t allow' }))
    expect(lastCall()).toEqual({ input: view, choice: 'deny' })
  })

  it('is a form that submits each button, so it needs no script to work', () => {
    render(<ConsentButtons view={view} />)
    for (const name of ['Allow this connection', 'Don’t allow']) {
      const button = screen.getByRole('button', { name })
      expect(button.getAttribute('type')).toBe('submit')
      expect(button.closest('form')).not.toBeNull()
    }
  })

  it('shows a refusal where the buttons are', async () => {
    render(<ConsentButtons view={view} />)
    await userEvent.click(screen.getByRole('button', { name: 'Allow this connection' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Refused.'))
  })
})
