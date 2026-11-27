// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The agents module is replaced: this tests the page's wiring, not the checks
const mocks = vi.hoisted(() => ({
  continueAuthorization: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`)
  }),
}))
vi.mock('@/modules/agents/server', () => ({
  continueAuthorization: mocks.continueAuthorization,
  ContinueCard: ({ view }: { view: { clientName: string; next: string } }) => (
    <a data-testid="continue" href={view.next}>
      {view.clientName}
    </a>
  ),
  ConnectionNotice: ({ notice }: { notice: { kind: string } }) => (
    <p data-testid="notice">{notice.kind}</p>
  ),
}))
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': '1.2.3.4' }),
}))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))

import AuthorizePage, { metadata } from './page'

const page = (query: Record<string, string | string[]> = {}) => ({
  searchParams: Promise.resolve(query),
})

beforeEach(() => mocks.continueAuthorization.mockReset())
afterEach(cleanup)

describe('/oauth/authorize', () => {
  it('hands the request and the request headers to the module, untouched', async () => {
    mocks.continueAuthorization.mockResolvedValue({ kind: 'refused', message: 'x' })
    await AuthorizePage(page({ client_id: 'mcp_abc', state: ['a', 'b'] }))
    const [params, headers] = mocks.continueAuthorization.mock.lastCall ?? []
    expect(params).toEqual({ client_id: 'mcp_abc', state: ['a', 'b'] })
    expect((headers as Headers).get('x-forwarded-for')).toBe('1.2.3.4')
  })

  it('carries a checked request on to the approval page, on this site', async () => {
    mocks.continueAuthorization.mockResolvedValue({
      kind: 'continue',
      clientName: 'Claude',
      redirectHost: 'claude.ai',
      next: '/oauth/approve?client_id=mcp_abc',
    })
    render(await AuthorizePage(page()))
    expect(screen.getByTestId('continue').getAttribute('href')).toBe(
      '/oauth/approve?client_id=mcp_abc',
    )
  })

  it('explains a request it cannot trust', async () => {
    mocks.continueAuthorization.mockResolvedValue({ kind: 'refused', message: 'x' })
    render(await AuthorizePage(page()))
    expect(screen.getByTestId('notice').textContent).toBe('refused')
  })

  it('sends an error back to the AI tool', async () => {
    mocks.continueAuthorization.mockResolvedValue({
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
