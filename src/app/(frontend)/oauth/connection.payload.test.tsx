import { renderToStaticMarkup } from 'react-dom/server'
import type { Payload } from 'payload'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { createHash, randomBytes } from 'node:crypto'

import { CONNECTION_REFUSED, MINIMAL_SCOPES } from '@/modules/agents'
import { getServerSideURL } from '@/platform/lib/getURL'
import {
  bootPayload,
  createAccount,
  testPassword,
  type Account,
} from '@/platform/payload/testing/inMemoryPayload'

/**
 * The connection pages as a browser reaches them (#1501), with a real sign-in cookie and the
 * fetch-metadata headers a browser sends: the first page from the AI tool's own site
 * (`cross-site`, no `Origin`), the approval page from our own (`same-origin`). Payload's CSRF
 * check ignores the sign-in cookie on a cross-site visit, which is why the first page reads no
 * session and shows nothing about any account, and why the approval, where the session is read,
 * is a page of its own. Nothing here is mocked but the request's headers.
 */

const request = vi.hoisted(() => ({ headers: new Headers() }))
vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ headers: async () => request.headers }))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`)
  },
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}))

let payload: Payload
let admin: Account
let clientId: string
let challenge: string
let cookie: string
let editorCookie: string

const sessionCookie = async (account: Account) => {
  const { token } = await payload.login({
    collection: 'users',
    data: { email: account.email, password: testPassword(account.name ?? '') },
  })
  return `payload-token=${token}`
}

/** The headers of a browser opening a page: from the AI tool's site, or from this one */
const BROWSER = {
  fromTheTool: {
    'sec-fetch-site': 'cross-site',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-dest': 'document',
  },
  fromThisSite: {
    'sec-fetch-site': 'same-origin',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-dest': 'document',
  },
} as const
const open = (from: keyof typeof BROWSER, cookies?: string) => {
  request.headers = new Headers({ ...BROWSER[from], ...(cookies ? { cookie: cookies } : {}) })
}

const html = async (route: 'authorize' | 'approve', query: Record<string, string>) => {
  const { default: Page } =
    route === 'authorize' ? await import('./authorize/page') : await import('./approve/page')
  return renderToStaticMarkup(await Page({ searchParams: Promise.resolve(query) }))
}
const REDIRECT = 'https://claude.ai/api/mcp/auth_callback'
const query = () => ({
  response_type: 'code',
  client_id: clientId,
  redirect_uri: REDIRECT,
  code_challenge: challenge,
  code_challenge_method: 'S256',
  state: 'state-1',
  resource: `${getServerSideURL()}/api/mcp`,
})

beforeAll(async () => {
  ;({ payload } = await bootPayload())
  admin = await createAccount(payload, 'admin', 'ana')
  const agent = await createAccount(payload, 'agent', 'scout')
  const client = await payload.create({
    collection: 'oauth-clients',
    data: {
      name: 'Claude',
      agent: agent.id,
      redirectUris: [{ uri: REDIRECT }],
      scopes: [...MINIMAL_SCOPES],
    },
    user: admin,
    overrideAccess: false,
  })
  clientId = client.clientId ?? ''
  challenge = createHash('sha256').update(randomBytes(32)).digest('base64url')
  cookie = await sessionCookie(admin)
  editorCookie = await sessionCookie(await createAccount(payload, 'editor', 'ed'))
}, 60_000)
beforeEach(() => {
  request.headers = new Headers()
})

describe('the first page, opened from the AI tool', () => {
  it('shows who is asking and a way to continue on this site, and no account data or approval', async () => {
    open('fromTheTool', cookie)
    const page = await html('authorize', query())
    expect(page).toContain('Claude')
    expect(page).toContain('claude.ai')
    expect(page).toContain('Continue to approval')
    expect(page).toContain('href="/oauth/approve?')
    expect(page).not.toContain('Allow this connection')
    expect(page).not.toContain('scout') // the agent account
    expect(page).not.toContain(admin.email)
  })

  it('looks the same to a signed-in admin, a signed-out visitor and an editor: it reads no session', async () => {
    open('fromTheTool')
    const visitor = await html('authorize', query())
    open('fromTheTool', cookie)
    expect(await html('authorize', query())).toBe(visitor)
    open('fromTheTool', editorCookie)
    expect(await html('authorize', query())).toBe(visitor)
  })

  it('carries exactly the checked request to the approval page', async () => {
    open('fromTheTool', cookie)
    const page = await html('authorize', query())
    const href = /href="(\/oauth\/approve\?[^"]+)"/.exec(page)?.[1]?.replaceAll('&amp;', '&') ?? ''
    const carried = new URL(href, 'http://x').searchParams
    expect(Object.fromEntries(carried)).toMatchObject({
      client_id: clientId,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state: 'state-1',
      response_type: 'code',
    })
  })
})

describe('the approval page, opened from this site', () => {
  const approvePath = async () => {
    open('fromTheTool', cookie)
    const page = await html('authorize', query())
    return /href="\/oauth\/approve\?([^"]+)"/.exec(page)?.[1]?.replaceAll('&amp;', '&') ?? ''
  }
  const params = async () => Object.fromEntries(new URLSearchParams(await approvePath()))

  it('shows a signed-in admin the approval, with the tool and the agent account', async () => {
    const carried = await params()
    open('fromThisSite', cookie)
    const page = await html('approve', carried)
    expect(page).toContain('Allow this connection')
    expect(page).toContain('Claude')
    expect(page).toContain('scout')
  })

  it('is not an approval for a request opened from another site: the cookie is ignored there', async () => {
    const carried = await params()
    open('fromTheTool', cookie)
    const page = await html('approve', carried)
    expect(page).not.toContain('Allow this connection')
    expect(page).toContain('Log in with an admin account')
  })

  it('sends a signed-out visitor to log in and back to this same request', async () => {
    const carried = await params()
    open('fromThisSite')
    const page = await html('approve', carried)
    expect(page).not.toContain('Allow this connection')
    const returnTo = `/oauth/approve?${new URLSearchParams(carried).toString()}`
    expect(page).toContain(
      `href="/login?next=${encodeURIComponent(returnTo).replaceAll('&', '&amp;')}"`,
    )
  })

  it('tells a signed-in editor only an admin can allow it', async () => {
    const carried = await params()
    open('fromThisSite', editorCookie)
    const page = await html('approve', carried)
    expect(page).not.toContain('Allow this connection')
    expect(page).toContain('Only an admin can allow this')
  })

  it('shows nothing of an API key or an access token sent as a header', async () => {
    const carried = await params()
    request.headers = new Headers({ ...BROWSER.fromThisSite, authorization: 'Bearer sea_nothing' })
    const page = await html('approve', carried)
    expect(page).not.toContain('Allow this connection')
  })

  it('checks the request again: a changed client is refused, never approved', async () => {
    const carried = await params()
    open('fromThisSite', cookie)
    const page = await html('approve', { ...carried, client_id: 'mcp_unknown' })
    expect(page).not.toContain('Allow this connection')
    expect(page).toContain(CONNECTION_REFUSED)
  })
})

describe('pressing a button on the approval page', () => {
  /** The form's fields as the browser sends them: the pressed button's name and value */
  const pressed = (decision: string) => {
    const form = new FormData()
    form.set('decision', decision)
    return form
  }

  /** The page's server action, as the browser calls it from this site with the session cookie */
  const press = async (decision: 'approve' | 'deny') => {
    const { beginAuthorization } = await import('@/modules/agents/server')
    const begun = await beginAuthorization(query(), new Headers(), { id: admin.id, isAdmin: true })
    if (begun.kind !== 'consent') throw new Error('expected the approval')
    const { decideConnectionForm } = await import('@/modules/agents/actions')
    open('fromThisSite', cookie)
    return decideConnectionForm(
      { request: begun.view.request, ticket: begun.view.ticket },
      null,
      pressed(decision),
    )
  }

  it('sends the browser back to the AI tool with a code when a signed-in admin allows it', async () => {
    await expect(press('approve')).rejects.toThrow(
      /^NEXT_REDIRECT https:\/\/claude\.ai\/api\/mcp\/auth_callback\?.*code=sec_/,
    )
  })

  it('is refused once the admin has been made an editor, though the page was opened as an admin', async () => {
    await payload.db.updateOne({ collection: 'users', id: admin.id, data: { role: 'editor' } })
    try {
      expect(await press('approve')).toMatchObject({
        message: CONNECTION_REFUSED,
      })
    } finally {
      await payload.db.updateOne({ collection: 'users', id: admin.id, data: { role: 'admin' } })
    }
  })

  it('is refused from another site, where the session is not read', async () => {
    const { beginAuthorization } = await import('@/modules/agents/server')
    const begun = await beginAuthorization(query(), new Headers(), { id: admin.id, isAdmin: true })
    if (begun.kind !== 'consent') throw new Error('expected the approval')
    const { decideConnectionForm } = await import('@/modules/agents/actions')
    open('fromTheTool', cookie)
    const answer = await decideConnectionForm(
      { request: begun.view.request, ticket: begun.view.ticket },
      null,
      pressed('approve'),
    )
    expect(answer.message).toBe(CONNECTION_REFUSED)
  })
})
