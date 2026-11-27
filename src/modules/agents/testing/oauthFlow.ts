import { createHash, randomBytes } from 'node:crypto'

import type { Payload } from 'payload'

import { bootPayload, createAccount } from '@/platform/payload/testing/inMemoryPayload'

import { getServerSideURL } from '@/platform/lib/getURL'
import type { Account } from '@/platform/payload/testing/inMemoryPayload'

import { OAUTH_CLIENTS } from '../domain/oauth/constants'
import { mcpResource } from '../domain/oauth/resource'
import type { Viewer } from '../domain/oauth/types'
import type { beginAuthorization } from '../use-cases/oauth/beginAuthorization'
import type { decideConsent } from '../use-cases/oauth/decideConsent'

/**
 * Helpers for the tests that run the OAuth sign-in against Payload on an in-memory database
 * (#1501): register a client as an admin, ask for a connection as an AI tool would, approve it
 * as an admin, and trade the code for tokens. The use cases are imported when called, because the
 * Payload config they reach must load after `bootPayload` has set the test environment.
 */

export const begin = async (...args: Parameters<typeof beginAuthorization>) =>
  (await import('../use-cases/oauth/beginAuthorization')).beginAuthorization(...args)
export const decide = async (...args: Parameters<typeof decideConsent>) =>
  (await import('../use-cases/oauth/decideConsent')).decideConsent(...args)

export const REDIRECT = 'https://claude.ai/api/mcp/auth_callback'
export const RESOURCE = mcpResource(getServerSideURL())

export const pkce = () => {
  const verifier = randomBytes(32).toString('base64url')
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') }
}

export const viewerOf = (account: Account): Viewer => ({
  id: account.id,
  isAdmin: account.role === 'admin',
})

/** Registers a client as the admin does in Admin, and gives its ID. */
export async function registerClient(
  payload: Payload,
  admin: Account,
  agent: Account,
  over: { redirectUris?: string[]; enabled?: boolean; name?: string } = {},
): Promise<string> {
  const client = await payload.create({
    collection: OAUTH_CLIENTS,
    data: {
      name: over.name ?? 'Claude',
      agent: agent.id,
      enabled: over.enabled ?? true,
      redirectUris: (over.redirectUris ?? [REDIRECT]).map((uri) => ({ uri })),
    },
    user: admin,
    overrideAccess: false,
  })
  return client.clientId ?? ''
}

export const authorizeParams = (
  clientId: string,
  challenge: string,
  over: Record<string, string | string[] | undefined> = {},
) => ({
  response_type: 'code',
  client_id: clientId,
  redirect_uri: REDIRECT,
  code_challenge: challenge,
  code_challenge_method: 'S256',
  state: 'state-1',
  resource: RESOURCE,
  ...over,
})

/** The consent page for these parameters, approved by `admin`: the redirect back, or why not. */
export async function approve(
  params: Record<string, string | string[] | undefined>,
  admin: Account,
) {
  const begun = await begin(params, viewerOf(admin))
  if (begun.kind !== 'consent') return begun
  return decide(begun.view.request, begun.view.ticket, 'approve', viewerOf(admin))
}

/** The one document a test's query must have found, or a failure that says so. */
export function onlyDoc<T>(result: { docs: T[] }): T {
  const [doc] = result.docs
  if (doc === undefined) throw new Error('The query found nothing')
  return doc
}

export const codeFrom = (url: string): string => new URL(url).searchParams.get('code') ?? ''

export type TokenBody = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  scope?: string
  error?: string
}

export const exchange = async (form: Record<string, string>, headers = new Headers()) => {
  const { exchangeToken } = await import('../use-cases/oauth/exchangeToken')
  const answer = await exchangeToken(form, headers)
  return { ...answer, body: answer.body as TokenBody }
}

/** Runs the whole flow for a registered client: approve, then trade the code. */
export async function signIn(payload: Payload, admin: Account, clientId: string) {
  const { verifier, challenge } = pkce()
  const decided = await approve(authorizeParams(clientId, challenge), admin)
  if (decided.kind !== 'redirect') throw new Error('The approval was refused')
  const code = codeFrom(decided.url)
  const answer = await exchange({
    grant_type: 'authorization_code',
    client_id: clientId,
    code,
    code_verifier: verifier,
    redirect_uri: REDIRECT,
  })
  const body = answer.body
  if (!body.access_token || !body.refresh_token) throw new Error('The sign-in gave no tokens')
  const tokens = { ...body, access_token: body.access_token, refresh_token: body.refresh_token }
  return { ...answer, body: tokens, code, verifier }
}

/** Boots Payload with an admin, an agent account and one registered client. */
export async function bootOAuth() {
  const { payload } = await bootPayload()
  const admin = await createAccount(payload, 'admin', 'ana')
  const agent = await createAccount(payload, 'agent', 'scout')
  const clientId = await registerClient(payload, admin, agent)
  return { payload, admin, agent, clientId }
}
