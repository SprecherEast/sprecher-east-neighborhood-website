import type { CollectionAfterChangeHook, PayloadRequest } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { OAuthClients } from './oauthClients'
import { OAuthTokens } from './oauthTokens'
import { REVOKING_FAMILY, revokeUnrevoked } from './revokeTokens'

/** The one statement that revokes sign-ins, and the two hooks that make it (#1501). */

const reqWith = (context: Record<string, unknown> = {}) => {
  const update = vi.fn().mockResolvedValue({ docs: [] })
  return { req: { payload: { update }, context } as unknown as PayloadRequest, update }
}
const hook = (collection: typeof OAuthClients): CollectionAfterChangeHook => {
  const found = collection.hooks?.afterChange?.[0]
  if (!found) throw new Error('no afterChange hook')
  return found
}
const run = (collection: typeof OAuthClients, args: Record<string, unknown>) =>
  hook(collection)(args as never)

describe('revokeUnrevoked', () => {
  it('revokes only what is not revoked yet, with the flag that stops the token hook', async () => {
    const { req, update } = reqWith()
    await revokeUnrevoked(req, { family: { equals: 'f' } }, '2026-01-01T00:00:00.000Z')
    expect(update).toHaveBeenCalledWith({
      collection: 'oauth-tokens',
      where: { family: { equals: 'f' }, revokedAt: { exists: false } },
      data: { revokedAt: '2026-01-01T00:00:00.000Z' },
      overrideAccess: true,
      req,
      context: { revokingOAuthFamily: true },
    })
  })

  it('names the flag the token hook reads', () => {
    expect(REVOKING_FAMILY).toEqual({ revokingOAuthFamily: true })
  })
})

describe('the hooks that revoke', () => {
  it('a client moved to another agent revokes its tokens with the flag set', async () => {
    const { req, update } = reqWith()
    await run(OAuthClients, {
      doc: { id: 7, agent: 2 },
      previousDoc: { agent: 1 },
      operation: 'update',
      req,
    })
    expect(update).toHaveBeenCalledOnce()
    expect(update.mock.calls[0]?.[0]).toMatchObject({
      where: { client: { equals: 7 }, revokedAt: { exists: false } },
      context: REVOKING_FAMILY,
    })
  })

  it('a client that keeps its agent revokes nothing', async () => {
    const { req, update } = reqWith()
    await run(OAuthClients, {
      doc: { id: 7, agent: 1 },
      previousDoc: { agent: 1 },
      operation: 'update',
      req,
    })
    expect(update).not.toHaveBeenCalled()
  })

  it('a token revoked in Admin revokes its family with the flag set', async () => {
    const { req, update } = reqWith()
    await run(OAuthTokens, {
      doc: { family: 'f', revokedAt: '2026-01-01T00:00:00.000Z' },
      previousDoc: {},
      req,
    })
    expect(update.mock.calls[0]?.[0]).toMatchObject({
      where: { family: { equals: 'f' }, revokedAt: { exists: false } },
      data: { revokedAt: '2026-01-01T00:00:00.000Z' },
      context: REVOKING_FAMILY,
    })
  })

  it('a token revoked as part of a family revocation does not start another', async () => {
    const { req, update } = reqWith(REVOKING_FAMILY)
    await run(OAuthTokens, { doc: { family: 'f', revokedAt: 'x' }, previousDoc: {}, req })
    expect(update).not.toHaveBeenCalled()
  })
})
