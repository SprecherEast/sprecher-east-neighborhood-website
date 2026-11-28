// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import { SCOPE_LABELS } from '../domain/scopes'
import type { ConsentView } from '../use-cases/oauth/beginAuthorization'
import { ConsentCard } from './ConsentCard'

// The buttons post to a server action; this test is about what the admin is shown to approve
vi.mock('../actions', () => ({ decideConnectionForm: vi.fn() }))
vi.mock('./ConsentButtons.client', () => ({ ConsentButtons: () => null }))

afterEach(cleanup)

const view = (scope: string): ConsentView => ({
  clientName: 'Claude',
  redirectHost: 'claude.ai',
  agentName: 'Claude agent',
  ticket: 'ticket',
  request: {
    clientId: 'mcp_abc',
    redirectUri: 'https://claude.ai/cb',
    state: 'state-1',
    codeChallenge: 'c'.repeat(43),
    resource: 'https://sprechereast.com/api/mcp',
    scope,
  },
})

describe('ConsentCard', () => {
  it('lists what the AI agent will be able to do, and only that', () => {
    render(<ConsentCard view={view('read')} />)
    expect(screen.getByText(SCOPE_LABELS.read)).toBeTruthy()
    expect(screen.queryByText(SCOPE_LABELS.suggest)).toBeNull()
  })

  it('lists every scope it was given', () => {
    render(<ConsentCard view={view('read suggest')} />)
    expect(screen.getByText(SCOPE_LABELS.read)).toBeTruthy()
    expect(screen.getByText(SCOPE_LABELS.suggest)).toBeTruthy()
  })

  it('does not list a name that is not a scope, and still says it cannot publish', () => {
    render(<ConsentCard view={view('read publish admin')} />)
    expect(screen.queryByText(/publish$/i)).toBeNull()
    expect(screen.getByText(/can’t publish/i)).toBeTruthy()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<ConsentCard view={view('read suggest')} />)
    await expectAccessible(container)
  })
})
