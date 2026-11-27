import type { Payload } from 'payload'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createAccount,
  testPassword,
  type Account,
} from '@/platform/payload/testing/inMemoryPayload'
import { createMcpKey } from '@/platform/payload/testing/mcpRequest'

import { bootOAuth, signIn } from '../../testing/oauthFlow'

/**
 * Who `getViewer` says is signed in (#1501): the guard that decides who is shown the approval.
 * It reads a real session the way a browser request carries one, a cookie with the
 * fetch-metadata headers, so each case below is an account and a request, not a hand-made viewer.
 */

const request = vi.hoisted(() => ({ headers: new Headers() }))
vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ headers: async () => request.headers }))

let payload: Payload
let admin: Account
let agent: Account
const cookies: Record<string, string> = {}
const KEY = 'viewer-suite-key-0123456789abcdef'

const SAME_ORIGIN = { 'sec-fetch-site': 'same-origin', 'sec-fetch-mode': 'navigate' }

const cookieFor = async (account: Account) => {
  const { token } = await payload.login({
    collection: 'users',
    data: { email: account.email, password: testPassword(account.name ?? '') },
  })
  return `payload-token=${token}`
}
const viewer = async (headers: Record<string, string>) => {
  request.headers = new Headers(headers)
  const { getViewer } = await import('./viewer')
  return getViewer()
}

beforeAll(async () => {
  ;({ payload, admin, agent } = await bootOAuth())
  cookies.admin = await cookieFor(admin)
  cookies.editor = await cookieFor(await createAccount(payload, 'editor', 'ed'))
  cookies.guest = await cookieFor(await createAccount(payload, 'guest', 'gus'))
  await createMcpKey(payload, admin, agent.id, KEY)
}, 60_000)
beforeEach(() => {
  request.headers = new Headers()
})

describe('getViewer', () => {
  it('says an admin is an admin, with their account id', async () => {
    expect(await viewer({ ...SAME_ORIGIN, cookie: cookies.admin ?? '' })).toEqual({
      id: admin.id,
      isAdmin: true,
    })
  })

  it.each(['editor', 'guest'])('says a signed-in %s is not an admin', async (role) => {
    const found = await viewer({ ...SAME_ORIGIN, cookie: cookies[role] ?? '' })
    expect(found).not.toBeNull()
    expect(found?.isAdmin).toBe(false)
  })

  it('says nobody is signed in with no cookie', async () => {
    expect(await viewer(SAME_ORIGIN)).toBeNull()
  })

  it('ignores the cookie on a visit from another site, where Payload withholds it', async () => {
    const cross = { 'sec-fetch-site': 'cross-site', 'sec-fetch-mode': 'navigate' }
    expect(await viewer({ ...cross, cookie: cookies.admin ?? '' })).toBeNull()
  })

  it('is no one for a credential that is no account, even one Payload says is an admin', async () => {
    // Payload's own check does not sign an MCP API key in as anyone today; this is the guard for
    // a strategy that ever gave a non-account user a role
    const { getOAuthContext } = await import('./context')
    const { payload: live } = await getOAuthContext()
    vi.spyOn(live, 'auth').mockResolvedValue({
      user: { id: 5, role: 'admin', collection: 'payload-mcp-api-keys' },
      permissions: {},
      responseHeaders: new Headers(),
    } as never)
    expect(await viewer({ ...SAME_ORIGIN, authorization: 'Bearer anything' })).toBeNull()
  })

  it('is no one for an API key sent as a header', async () => {
    expect(
      await viewer({ ...SAME_ORIGIN, authorization: `payload-mcp-api-keys API-Key ${KEY}` }),
    ).toBeNull()
  })

  it('is no one for an OAuth access token, which signs in to nothing but the AI agent address', async () => {
    const { body } = await signIn(payload, admin, (await clientId()) ?? '')
    expect(await viewer({ ...SAME_ORIGIN, authorization: `Bearer ${body.access_token}` })).toBeNull()
  })
})

const clientId = async () => {
  const { docs } = await payload.find({ collection: 'oauth-clients', overrideAccess: true })
  return docs[0]?.clientId
}
