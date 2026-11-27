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
  ConnectionPage: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <>
      <h1>{title}</h1>
      {children}
    </>
  ),
  beginAuthorization: mocks.beginAuthorization,
  getViewer: mocks.getViewer,
  ConsentCard: ({ view }: { view: { clientName: string } }) => (
    <p data-testid="consent">{view.clientName}</p>
  ),
  ConnectionNotice: ({ notice, signInHref }: { notice: { kind: string }; signInHref?: string }) => (
    <p data-testid="notice" data-href={signInHref}>
      {notice.kind}
    </p>
  ),
}))
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': '1.2.3.4' }),
}))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))

import ApprovePage, { metadata } from './page'

const page = (query: Record<string, string | string[]> = {}) => ({
  searchParams: Promise.resolve(query),
})

beforeEach(() => {
  mocks.beginAuthorization.mockReset()
  mocks.getViewer.mockReset().mockResolvedValue({ id: 1, isAdmin: true })
})
afterEach(cleanup)

describe('/oauth/approve', () => {
  it('hands the request, the headers and the viewer to the module, untouched', async () => {
    mocks.beginAuthorization.mockResolvedValue({ kind: 'refused', message: 'x' })
    await ApprovePage(page({ client_id: 'mcp_abc', state: ['a', 'b'] }))
    const [params, headers, viewer] = mocks.beginAuthorization.mock.lastCall ?? []
    expect(params).toEqual({ client_id: 'mcp_abc', state: ['a', 'b'] })
    expect((headers as Headers).get('x-forwarded-for')).toBe('1.2.3.4')
    expect(viewer).toEqual({ id: 1, isAdmin: true })
  })

  it('shows an admin the approval', async () => {
    mocks.beginAuthorization.mockResolvedValue({ kind: 'consent', view: { clientName: 'Claude' } })
    render(await ApprovePage(page()))
    expect(screen.getByTestId('consent').textContent).toBe('Claude')
  })

  it('sends a visitor to log in and back to this same request', async () => {
    const returnTo = '/oauth/approve?client_id=mcp_abc&state=s'
    mocks.beginAuthorization.mockResolvedValue({ kind: 'sign-in-needed', returnTo })
    render(await ApprovePage(page()))
    expect(screen.getByTestId('notice').getAttribute('data-href')).toBe(
      `/login?next=${encodeURIComponent(returnTo)}`,
    )
  })

  it('tells a non-admin an admin is needed, with the plain log in page as the way in', async () => {
    mocks.beginAuthorization.mockResolvedValue({ kind: 'admin-needed' })
    render(await ApprovePage(page()))
    expect(screen.getByTestId('notice').textContent).toBe('admin-needed')
    expect(screen.getByTestId('notice').getAttribute('data-href')).toBe('/login')
  })

  it('sends an error back to the AI tool', async () => {
    mocks.beginAuthorization.mockResolvedValue({
      kind: 'redirect',
      url: 'https://claude.ai/cb?error=invalid_request',
    })
    await expect(ApprovePage(page())).rejects.toThrow('NEXT_REDIRECT https://claude.ai/cb')
  })

  it('keeps the page out of search and its address out of referrers', () => {
    expect(metadata.robots).toMatchObject({ index: false })
    expect(metadata.referrer).toBe('no-referrer')
  })
})
