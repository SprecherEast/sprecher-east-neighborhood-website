import { randomBytes } from 'node:crypto'

import type { Payload } from 'payload'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { hasAdmin, hasAdminOrEditor } from '@/platform/payload/roles'

import {
  PREVIEW_ACCOUNT_ROLES,
  previewAccountEmail,
  type PreviewPasswords,
} from './preview-accounts'
import { seedPreviewDatabase } from './preview-database'

/**
 * A pull request preview's test accounts (#1393, part of #1077): one per role that signs in with a
 * password, made verified with no email, with a password that is new on every deploy. The first account
 * on an empty `users` collection becomes an admin (#354), so a reachable preview must never have it
 * empty. Payload runs on in-memory SQLite: no file, no network.
 */

let payload: Payload
const PREVIEW = { PREVIEW_NUMBER: '7' }

const newPasswords = (): PreviewPasswords =>
  Object.fromEntries(
    PREVIEW_ACCOUNT_ROLES.map((role) => [role, randomBytes(32).toString('hex')]),
  ) as PreviewPasswords

beforeAll(async () => {
  vi.stubEnv('DATABASE_URI', 'file::memory:')
  vi.stubEnv('PAYLOAD_SECRET', 'preview-database-test-secret-0123456789')
  vi.stubEnv('SMTP_HOST', '')
  const { getPayload } = await import('payload')
  payload = await getPayload({ config: await (await import('@payload-config')).default })
}, 60_000)

const accounts = () =>
  payload.find({
    collection: 'users',
    depth: 0,
    limit: 50,
    overrideAccess: true,
    showHiddenFields: true,
    sort: 'id',
  })
const signIn = (role: (typeof PREVIEW_ACCOUNT_ROLES)[number], password: string) =>
  payload.login({
    collection: 'users',
    data: { email: previewAccountEmail(role), password },
  })

describe('seedPreviewDatabase', () => {
  it.each([{}, { PREVIEW_NUMBER: '' }])(
    'refuses to run without a pull request number (a hand run against production), and makes nothing (%j)',
    async (env) => {
      await expect(seedPreviewDatabase(payload, newPasswords(), env)).rejects.toThrow(
        'only for a pull request',
      )
      expect((await accounts()).totalDocs).toBe(0)
    },
  )

  const first = newPasswords()

  it('makes one verified account per role on an empty database, the admin first, and no email', async () => {
    const send = vi.spyOn(payload.email, 'sendEmail') // Payload's verification mail goes through this one
    expect(await seedPreviewDatabase(payload, first, PREVIEW)).toEqual({ created: 4, refreshed: 0 })
    expect(send).not.toHaveBeenCalled()
    const { docs } = await accounts()
    expect(docs.map((d) => d.role)).toEqual(['admin', 'editor', 'resident', 'guest'])
    expect(docs.map((d) => d.email)).toEqual(PREVIEW_ACCOUNT_ROLES.map(previewAccountEmail))
    for (const doc of docs) expect(doc._verified).toBe(true)
    expect(docs.some((d) => d.role === 'agent')).toBe(false)
    send.mockRestore()
  })

  it.each(PREVIEW_ACCOUNT_ROLES)(
    'lets the %s sign in with its own password, and no other',
    async (role) => {
      const { user } = await signIn(role, first[role])
      expect(user?.role).toBe(role)
      for (const other of PREVIEW_ACCOUNT_ROLES.filter((r) => r !== role))
        await expect(signIn(role, first[other])).rejects.toThrow()
      await expect(signIn(role, 'password')).rejects.toThrow()
    },
  )

  // The real access rules of the users collection: who reaches the admin panel, who reads whom, who
  // makes accounts.
  const sessionOf = async (role: (typeof PREVIEW_ACCOUNT_ROLES)[number]) => {
    const { user } = await signIn(role, first[role])
    return { ...user!, collection: 'users' as const }
  }
  const usersAccess = () => payload.collections.users.config.access
  const can = {
    admin: { panel: true, staff: true, listsAll: true, creates: true },
    editor: { panel: true, staff: true, listsAll: false, creates: false },
    resident: { panel: false, staff: false, listsAll: false, creates: false },
    guest: { panel: false, staff: false, listsAll: false, creates: false },
  } as const

  it.each(PREVIEW_ACCOUNT_ROLES)('gives the %s exactly its role’s access', async (role) => {
    const user = await sessionOf(role)
    const expected = can[role]
    expect(Boolean(await usersAccess().admin?.({ req: { user } } as never))).toBe(expected.panel)
    expect(hasAdminOrEditor(user)).toBe(expected.staff)
    expect(hasAdmin(user)).toBe(role === 'admin')
    const asUser = { user, overrideAccess: false, depth: 0 } as const
    const list = payload.find({ collection: 'users', limit: 50, ...asUser })
    if (expected.listsAll) expect((await list).totalDocs).toBe(4)
    else await expect(list).rejects.toThrow() // only an admin lists accounts
    const byEmail = (r: (typeof PREVIEW_ACCOUNT_ROLES)[number]) =>
      accounts().then(({ docs }) => docs.find((d) => d.email === previewAccountEmail(r))!)
    const mine = await byEmail(role)
    const admin = await byEmail('admin')
    await expect(
      payload.findByID({ collection: 'users', id: mine.id, ...asUser }),
    ).resolves.toBeDefined()
    const theirs = payload.findByID({ collection: 'users', id: admin.id, ...asUser })
    if (role === 'admin') await expect(theirs).resolves.toBeDefined()
    else await expect(theirs).rejects.toThrow() // and no one reads another account
    const create = payload.create({
      collection: 'users',
      user,
      overrideAccess: false,
      depth: 0,
      data: {
        email: `made-by-${role}@example.com`,
        password: randomBytes(16).toString('hex'),
        role: 'guest',
      },
      disableVerificationEmail: true,
      draft: false,
    })
    if (expected.creates) await expect(create).resolves.toBeDefined()
    else await expect(create).rejects.toThrow()
    await payload.delete({
      collection: 'users',
      where: { email: { equals: `made-by-${role}@example.com` } },
      overrideAccess: true,
    })
  })

  it('on a redeploy makes new passwords work and the old ones fail, and signs everyone out', async () => {
    const old = await signIn('resident', first.resident)
    const oldToken = old.token ?? ''
    expect(
      (await payload.auth({ headers: new Headers({ authorization: `JWT ${oldToken}` }) })).user,
    ).not.toBeNull()
    const before = await accounts()
    const second = newPasswords()
    expect(await seedPreviewDatabase(payload, second, PREVIEW)).toEqual({
      created: 0,
      refreshed: 4,
    })
    const after = await accounts()
    expect(after.totalDocs).toBe(before.totalDocs)
    expect(after.docs.map((d) => d.id)).toEqual(before.docs.map((d) => d.id))
    for (const role of PREVIEW_ACCOUNT_ROLES) {
      await expect(signIn(role, first[role])).rejects.toThrow()
      expect((await signIn(role, second[role])).user?.role).toBe(role)
    }
    expect(
      (await payload.auth({ headers: new Headers({ authorization: `JWT ${oldToken}` }) })).user,
    ).toBeNull()
  })

  it('puts a changed role, an unverified or a locked account back, and leaves other accounts alone', async () => {
    const neighbor = await payload.create({
      collection: 'users',
      depth: 0,
      overrideAccess: true,
      data: {
        email: 'neighbor@example.com',
        password: randomBytes(16).toString('hex'),
        role: 'guest',
      },
      disableVerificationEmail: true,
    })
    const passwords = newPasswords()
    await seedPreviewDatabase(payload, passwords, PREVIEW)
    const editor = (await accounts()).docs.find((d) => d.email === previewAccountEmail('editor'))!
    await payload.update({
      collection: 'users',
      id: editor.id,
      data: { role: 'admin' },
      overrideAccess: true,
    })
    await payload.db.updateOne({
      collection: 'users',
      id: editor.id,
      data: { _verified: false },
      returning: false,
    })
    for (let i = 0; i < 6; i++) await signIn('editor', 'wrong').catch(() => undefined) // locks it out
    await expect(signIn('editor', passwords.editor)).rejects.toThrow()

    const next = newPasswords()
    await seedPreviewDatabase(payload, next, PREVIEW)
    const { user } = await signIn('editor', next.editor)
    expect(user?.role).toBe('editor')
    const kept = (await accounts()).docs.find((d) => d.id === neighbor.id)!
    expect(kept.email).toBe('neighbor@example.com')
    expect(kept.updatedAt).toBe(neighbor.updatedAt)
  })

  it('writes no password to the console or the log', async () => {
    const written: string[] = []
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((level) =>
      vi.spyOn(console, level).mockImplementation((...args) => void written.push(args.join(' '))),
    )
    const logger = (['info', 'warn', 'error', 'debug'] as const).map((level) =>
      vi
        .spyOn(payload.logger, level)
        .mockImplementation(((...args: unknown[]) => void written.push(args.join(' '))) as never),
    )
    const passwords = newPasswords()
    await seedPreviewDatabase(payload, passwords, PREVIEW)
    for (const spy of [...spies, ...logger]) spy.mockRestore()
    for (const password of Object.values(passwords))
      expect(written.join('\n')).not.toContain(password)
  })
})
