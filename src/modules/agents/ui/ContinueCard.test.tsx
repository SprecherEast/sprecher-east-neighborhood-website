// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import { ContinueCard } from './ContinueCard'

afterEach(cleanup)

const view = {
  kind: 'continue',
  clientName: 'Claude',
  redirectHost: 'claude.ai',
  next: '/oauth/approve?client_id=mcp_a',
} as const

describe('ContinueCard', () => {
  it('names the tool and where it returns to, and links on to the approval on this site', async () => {
    const { container } = render(<ContinueCard view={view} />)
    expect(screen.getByText('Claude')).toBeTruthy()
    expect(screen.getByText('claude.ai')).toBeTruthy()
    const link = screen.getByRole('link', { name: 'Continue to approval' })
    expect(link.getAttribute('href')).toBe('/oauth/approve?client_id=mcp_a')
    await expectAccessible(container)
  })

  it('has no approval button and no account', () => {
    render(<ContinueCard view={view} />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(document.body.textContent).not.toContain('Allow this connection')
  })
})
