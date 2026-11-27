import type { Payload } from 'payload'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import {
  bootPayload,
  createAccount,
  type Account,
} from '@/platform/payload/testing/inMemoryPayload'

import { registerClient, signIn, onlyDoc } from '../../testing/oauthFlow'

/**
 * Who may touch the OAuth collections (#1501): admins only, in every operation, and the rows the
 * sign-in writes are read-only even to them, except for revoking. A client must act as an agent
 * account, its redirect addresses are checked on save, and deleting it deletes its sign-ins.
 */

vi.mock('server-only', () => ({}))

let payload: Payload
let admin: Account
let agent: Account
let editor: Account
let clientId: string

beforeAll(async () => {
  ;({ payload } = await bootPayload())
  admin = await createAccount(payload, 'admin', 'ana')
  agent = await createAccount(payload, 'agent', 'scout')
  editor = await createAccount(payload, 'editor', 'ed')
  clientId = await registerClient(payload, admin, agent)
  await signIn(payload, admin, clientId)
}, 60_000)

const clientData = { name: 'Tool', agent: 0, redirectUris: [{ uri: 'https://claude.ai/cb' }] }
const asUser = (user: Account | undefined) => ({ user, overrideAccess: false as const })

describe.each([['oauth-clients'], ['oauth-tokens']] as const)('%s access', (collection) => {
  it.each([
    ['an editor', () => editor],
    ['an agent', () => agent],
    ['a visitor', () => undefined],
  ])('refuses %s every operation', async (_who, who) => {
    await expect(payload.find({ collection, ...asUser(who()) })).rejects.toThrow()
    await expect(
      payload.update({
        collection,
        where: { id: { exists: true } },
        data: {},
        ...asUser(who()),
      } as never),
    ).rejects.toThrow()
    await expect(
      payload.delete({ collection, where: { id: { exists: true } }, ...asUser(who()) }),
    ).rejects.toThrow()
  })

  it('lets an admin read', async () => {
    expect((await payload.find({ collection, ...asUser(admin) })).totalDocs).toBeGreaterThan(0)
  })
})

describe('OAuth clients', () => {
  it('cannot be created by an editor or an agent', async () => {
    for (const who of [editor, agent]) {
      await expect(
        payload.create({
          collection: 'oauth-clients',
          data: { ...clientData, agent: agent.id },
          ...asUser(who),
        }),
      ).rejects.toThrow()
    }
  })

  it('must act as an agent account, never staff', async () => {
    await expect(
      payload.create({
        collection: 'oauth-clients',
        data: { ...clientData, agent: admin.id },
        ...asUser(admin),
      }),
    ).rejects.toThrow()
  })

  it.each([
    'http://claude.ai/cb',
    'https://claude.ai/cb#frag',
    'javascript:alert(1)',
    'https://*.claude.ai/cb',
    'myapp://cb',
  ])('refuses the redirect address %s', async (uri) => {
    await expect(
      payload.create({
        collection: 'oauth-clients',
        data: { ...clientData, agent: agent.id, redirectUris: [{ uri }] },
        ...asUser(admin),
      }),
    ).rejects.toThrow()
  })

  it('needs at least one redirect address, so a client is never open to any', async () => {
    await expect(
      payload.create({
        collection: 'oauth-clients',
        data: { ...clientData, agent: agent.id, redirectUris: [] },
        ...asUser(admin),
      }),
    ).rejects.toThrow()
  })
})

describe('OAuth tokens', () => {
  const first = async () =>
    onlyDoc(
      await payload.find({ collection: 'oauth-tokens', depth: 0, limit: 1, ...asUser(admin) }),
    )

  it('cannot be created through the API, even by an admin', async () => {
    const row = await first()
    await expect(
      payload.create({
        collection: 'oauth-tokens',
        data: {
          kind: 'access',
          tokenHash: 'x',
          family: 'f',
          client: Number(row.client),
          agent: agent.id,
          resource: 'r',
          expiresAt: new Date().toISOString(),
        },
        ...asUser(admin),
      }),
    ).rejects.toThrow()
  })

  it('keep their other fields when an admin edits them: only revoking is allowed', async () => {
    const row = await first()
    const edited = await payload.update({
      collection: 'oauth-tokens',
      id: row.id,
      data: {
        resource: 'https://evil.example/',
        expiresAt: '2099-01-01T00:00:00.000Z',
        usedAt: null,
        family: 'other',
      },
      depth: 0,
      ...asUser(admin),
    })
    expect(edited).toMatchObject({
      resource: row.resource,
      expiresAt: row.expiresAt,
      family: row.family,
    })
  })

  describe('once revoked', () => {
    const revokeOne = async () => {
      const created = await signIn(payload, admin, clientId)
      const rows = await payload.find({
        collection: 'oauth-tokens',
        where: { kind: { equals: 'access' }, revokedAt: { exists: false } },
        sort: '-id',
        limit: 1,
        depth: 0,
        ...asUser(admin),
      })
      const row = onlyDoc(rows)
      expect(created.status).toBe(200)
      const at = '2026-11-27T10:00:00.000Z'
      const revoked = await payload.update({
        collection: 'oauth-tokens',
        id: row.id,
        data: { revokedAt: at },
        depth: 0,
        ...asUser(admin),
      })
      return { row, at, revoked }
    }
    const edit = (id: number, revokedAt: string | null) =>
      payload.update({
        collection: 'oauth-tokens',
        id,
        data: { revokedAt },
        depth: 0,
        ...asUser(admin),
      })

    it('stays revoked: an admin cannot clear the date', async () => {
      const { row, at } = await revokeOne()
      await expect(edit(row.id, null)).rejects.toThrow('stays revoked')
      expect(
        onlyDoc(
          await payload.find({
            collection: 'oauth-tokens',
            where: { id: { equals: row.id } },
            depth: 0,
            ...asUser(admin),
          }),
        ).revokedAt,
      ).toBe(at)
    })

    it('stays revoked: an admin cannot move the date either', async () => {
      const { row } = await revokeOne()
      await expect(edit(row.id, '2027-01-01T00:00:00.000Z')).rejects.toThrow('stays revoked')
    })

    it('lets the same date be saved again, as the admin form sends it back unchanged', async () => {
      const { row, at } = await revokeOne()
      expect((await edit(row.id, at)).revokedAt).toBe(at)
    })
  })

  it('never show the stored hash, not even to an admin', async () => {
    const row = await first()
    expect(row).not.toHaveProperty('tokenHash')
  })
})

describe('deleting a client', () => {
  it('deletes its sign-ins with it, so nothing is left to block or to use', async () => {
    const own = await registerClient(payload, admin, agent, { name: 'Gone' })
    await signIn(payload, admin, own)
    const found = await payload.find({
      collection: 'oauth-clients',
      where: { clientId: { equals: own } },
      ...asUser(admin),
    })
    const id = onlyDoc(found).id
    const before = await payload.count({
      collection: 'oauth-tokens',
      where: { client: { equals: id } },
      overrideAccess: true,
    })
    expect(before.totalDocs).toBeGreaterThan(0)
    await payload.delete({ collection: 'oauth-clients', id, ...asUser(admin) })
    const after = await payload.count({
      collection: 'oauth-tokens',
      where: { client: { equals: id } },
      overrideAccess: true,
    })
    expect(after.totalDocs).toBe(0)
  })
})
