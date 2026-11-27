import type { Payload } from 'payload'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import type { Account } from '@/platform/payload/testing/inMemoryPayload'

import {
  approve,
  authorizeParams,
  bootOAuth,
  codeFrom,
  exchange,
  pkce,
  REDIRECT,
  registerClient,
  RESOURCE,
  onlyDoc,
} from '../../testing/oauthFlow'

/**
 * What the token address refuses (#1501): other grants, another redirect address or resource, a
 * verifier of the wrong shape, a code for another client or a client switched off, and a
 * connection past its limit.
 */

vi.mock('server-only', () => ({}))

let payload: Payload
let admin: Account
let agent: Account
let clientId: string

beforeAll(async () => {
  ;({ payload, admin, agent, clientId } = await bootOAuth())
}, 60_000)

describe('the token address', () => {
  const base = async () => {
    const { verifier, challenge: c } = pkce()
    const decided = await approve(authorizeParams(clientId, c), admin)
    if (decided.kind !== 'redirect') throw new Error('expected a redirect')
    return {
      grant_type: 'authorization_code',
      client_id: clientId,
      code: codeFrom(decided.url),
      code_verifier: verifier,
      redirect_uri: REDIRECT,
    }
  }

  it.each(['client_credentials', 'password', 'implicit', ''])(
    'refuses the %j grant',
    async (grant) => {
      const answer = await exchange({ grant_type: grant, client_id: clientId })
      expect(answer.status).toBe(400)
      expect(answer.body.error).toBe('unsupported_grant_type')
    },
  )

  it.each(['code', 'client_id', 'code_verifier', 'redirect_uri', 'grant_type', 'resource'])(
    'refuses a repeated %s with invalid_request, not a server error (RFC 6749 section 3.2)',
    async (name) => {
      const form = await base()
      const logged = vi.spyOn(payload.logger, 'error')
      const answer = await exchange({
        ...form,
        [name]: [form[name as keyof typeof form] ?? RESOURCE, 'x'],
      })
      expect(answer.status).toBe(400)
      expect(answer.body.error).toBe('invalid_request')
      expect(answer.body.access_token).toBeUndefined()
      expect(logged).not.toHaveBeenCalled()
      logged.mockRestore()
    },
  )

  it('refuses a redirect address that differs from the one approved', async () => {
    const form = await base()
    const answer = await exchange({ ...form, redirect_uri: 'https://evil.example/cb' })
    expect(answer.status).toBe(400)
    expect(answer.body.access_token).toBeUndefined()
  })

  it('refuses another resource, and accepts the MCP address', async () => {
    const form = await base()
    const wrong = await exchange({ ...form, resource: 'https://sprechereast.com/api/graphql' })
    expect(wrong.body.error).toBe('invalid_target')
    expect((await exchange({ ...form, resource: RESOURCE })).status).toBe(200)
  })

  it('refuses a verifier that is not RFC 7636 shaped, and spends the code so it cannot be tried again', async () => {
    const form = await base()
    const short = await exchange({ ...form, code_verifier: 'a' })
    expect(short.status).toBe(400)
    expect((await exchange(form)).status).toBe(400)
  })

  it('refuses a code that has expired, with the right verifier', async () => {
    const form = await base()
    const { docs } = await payload.find({
      collection: 'oauth-tokens',
      where: { kind: { equals: 'code' } },
      sort: '-createdAt',
      limit: 1,
      overrideAccess: true,
    })
    await payload.db.updateOne({
      collection: 'oauth-tokens',
      id: onlyDoc({ docs }).id,
      data: { expiresAt: new Date(Date.now() - 1000).toISOString() },
    })
    const answer = await exchange(form)
    expect(answer.status).toBe(400)
    expect(answer.body.error).toBe('invalid_grant')
    expect(answer.body.access_token).toBeUndefined()
  })

  it('refuses a code made for another client', async () => {
    const other = await registerClient(payload, admin, agent, { name: 'Other' })
    const form = await base()
    const answer = await exchange({ ...form, client_id: other })
    expect(answer.status).toBe(400)
    expect(answer.body.error).toBe('invalid_grant')
  })

  it('refuses a client that is switched off, even with a good code', async () => {
    const off = await registerClient(payload, admin, agent, { name: 'Off' })
    const { verifier, challenge: c } = pkce()
    const decided = await approve(authorizeParams(off, c), admin)
    if (decided.kind !== 'redirect') throw new Error('expected a redirect')
    const found = await payload.find({
      collection: 'oauth-clients',
      where: { clientId: { equals: off } },
      user: admin,
      overrideAccess: false,
    })
    await payload.update({
      collection: 'oauth-clients',
      id: onlyDoc(found).id,
      data: { enabled: false },
      user: admin,
      overrideAccess: false,
    })
    const answer = await exchange({
      grant_type: 'authorization_code',
      client_id: off,
      code: codeFrom(decided.url),
      code_verifier: verifier,
      redirect_uri: REDIRECT,
    })
    expect(answer.status).toBe(400)
    expect(answer.body.access_token).toBeUndefined()
  })

  it('answers 429 past the limit for one connection, and says nothing of what it holds', async () => {
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.9' })
    const answers = []
    for (let i = 0; i < 31; i++) answers.push(await exchange({ grant_type: 'password' }, headers))
    expect(answers.at(-1)?.status).toBe(429)
    expect(answers.slice(0, 30).every((a) => a.status === 400)).toBe(true)
  })
})
