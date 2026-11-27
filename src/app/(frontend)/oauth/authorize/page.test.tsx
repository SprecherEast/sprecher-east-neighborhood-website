// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The agents module is replaced: this tests the page's wiring, not the sign-in
const mocks = vi.hoisted(() => ({
  beginAuthorization: vi.fn(),
  getViewer: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`)
  }),
}))
vi.mock('@/modules/agents/server', () => ({
  beginAuthorization: mocks.beginAuthorization,
  getViewer: mocks.getViewer,
  ConsentCard: ({ view }: { view: { clientName: string } }) => (
    <p data-testid="consent">{view.clientName}</p>
  ),
  ConnectionNotice: ({ notice, signInHref }: { notice: { kind: string }; signInHref: string }) => (
    <p data-testid="notice" data-href={signInHref}>
      {notice.kind}
    </p>
  ),
}))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))

import AuthorizePage, { metadata } from './page'

const page = (query: Record<string, string | string[]> = {}) => ({
  searchParams: Promise.resolve(query),
})

beforeEach(() => {
  mocks.beginAuthorization.mockReset()
  mocks.getViewer.mockReset().mockResolvedValue({ id: 1, isAdmin: true })
})
afterEach(cleanup)

describe('/oauth/authorize', () => {
  it('hands the request and the viewer to the module, untouched', async () => {
    mocks.beginAuthorization.mockResolvedValue({ kind: 'refused', message: 'x' })
    await AuthorizePage(page({ client_id: 'mcp_abc', state: ['a', 'b'] }))
    expect(mocks.beginAuthorization).toHaveBeenCalledWith(
      { client_id: 'mcp_abc', state: ['a', 'b'] },
      { id: 1, isAdmin: true },
    )
  })

  it('shows an admin the approval', async () => {
    mocks.beginAuthorization.mockResolvedValue({ kind: 'consent', view: { clientName: 'Claude' } })
    render(await AuthorizePage(page()))
    expect(screen.getByTestId('consent').textContent).toBe('Claude')
  })

  it('explains a request it cannot trust, with the log in page as the way in', async () => {
    mocks.beginAuthorization.mockResolvedValue({ kind: 'sign-in-needed' })
    render(await AuthorizePage(page()))
    expect(screen.getByTestId('notice').textContent).toBe('sign-in-needed')
    expect(screen.getByTestId('notice').getAttribute('data-href')).toBe('/login')
  })

  it('sends an error back to the AI tool', async () => {
    mocks.beginAuthorization.mockResolvedValue({
      kind: 'redirect',
      url: 'https://claude.ai/cb?error=invalid_request',
    })
    await expect(AuthorizePage(page())).rejects.toThrow('NEXT_REDIRECT https://claude.ai/cb')
  })

  it('keeps the page out of search and its address out of referrers', () => {
    expect(metadata.robots).toMatchObject({ index: false })
    expect(metadata.referrer).toBe('no-referrer')
  })
})
