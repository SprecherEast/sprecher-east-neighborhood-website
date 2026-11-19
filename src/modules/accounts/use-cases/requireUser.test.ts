import { beforeEach, describe, expect, it, vi } from 'vitest'

// Payload and Next's request APIs are replaced; `redirect` and `notFound` throw, as in Next.js
const edges = vi.hoisted(() => ({
  auth: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`)
  }),
  notFound: vi.fn(() => {
    throw new Error('not-found')
  }),
}))

vi.mock('payload', () => ({ getPayload: async () => ({ auth: edges.auth }) }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('next/navigation', () => ({ redirect: edges.redirect, notFound: edges.notFound }))

import { requireRole, requireUser } from './requireUser'

const signedIn = (role: string | null) => ({
  user: { id: 3, email: 'ada@example.com', name: 'Ada', role, collection: 'users' },
})

beforeEach(() => {
  edges.auth.mockReset()
})

describe('requireUser', () => {
  it('returns the signed-in user', async () => {
    edges.auth.mockResolvedValue(signedIn('resident'))
    expect(await requireUser()).toEqual({
      id: 3,
      email: 'ada@example.com',
      name: 'Ada',
      role: 'resident',
    })
  })

  // An MCP API key sent as a header authenticates as the key document itself (#336)
  it('counts an API key acting as itself as a visitor', async () => {
    edges.auth.mockResolvedValue({ user: { id: 3, collection: 'payload-mcp-api-keys' } })
    await expect(requireUser()).rejects.toThrow('redirect:/login')
  })

  it('sends a visitor to the sign-in page', async () => {
    edges.auth.mockResolvedValue({ user: null })
    await expect(requireUser()).rejects.toThrow('redirect:/login')
  })
})

describe('requireRole', () => {
  it('lets through a user with one of the roles', async () => {
    edges.auth.mockResolvedValue(signedIn('editor'))
    expect((await requireRole('admin', 'editor')).role).toBe('editor')
  })

  it('shows the 404 page to anyone signed in with another role', async () => {
    edges.auth.mockResolvedValue(signedIn('resident'))
    await expect(requireRole('admin', 'editor')).rejects.toThrow('not-found')
    edges.auth.mockResolvedValue(signedIn('editor'))
    await expect(requireRole('admin')).rejects.toThrow('not-found')
  })

  it('counts an account without a role as a guest', async () => {
    edges.auth.mockResolvedValue(signedIn(null))
    await expect(requireRole('admin', 'editor')).rejects.toThrow('not-found')
    expect((await requireRole('guest')).role).toBe('guest')
  })

  it('sends a visitor to the sign-in page first', async () => {
    edges.auth.mockResolvedValue({ user: null })
    await expect(requireRole('admin')).rejects.toThrow('redirect:/login')
  })
})
