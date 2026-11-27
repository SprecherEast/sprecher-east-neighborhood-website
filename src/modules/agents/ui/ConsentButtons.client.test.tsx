// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ decideConnection: vi.fn() }))
vi.mock('../actions', () => ({ decideConnection: mocks.decideConnection }))

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

beforeEach(() => mocks.decideConnection.mockReset().mockResolvedValue({ message: 'Refused.' }))
afterEach(cleanup)

describe('ConsentButtons', () => {
  it('sends the request, its ticket and the choice, for each button', async () => {
    render(<ConsentButtons view={view} />)
    await userEvent.click(screen.getByRole('button', { name: 'Allow this connection' }))
    expect(mocks.decideConnection).toHaveBeenLastCalledWith({ ...view, decision: 'approve' })
    await userEvent.click(screen.getByRole('button', { name: 'Don’t allow' }))
    expect(mocks.decideConnection).toHaveBeenLastCalledWith({ ...view, decision: 'deny' })
  })

  it('shows a refusal where the buttons are', async () => {
    render(<ConsentButtons view={view} />)
    await userEvent.click(screen.getByRole('button', { name: 'Allow this connection' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Refused.'))
  })
})
