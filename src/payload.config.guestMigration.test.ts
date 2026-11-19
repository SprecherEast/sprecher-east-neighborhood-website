import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-sqlite'
import { createLocalReq, type Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { down, up } from '@/migrations/20261031_214018_guest_role'
import { bootPayload, createAccount } from '@/platform/payload/testing/inMemoryPayload'

/**
 * The guest role migration (#520): existing residents become guests, and `down` restores them.
 * Other roles are never touched.
 */

let payload: Payload

beforeAll(async () => {
  ;({ payload } = await bootPayload())
  await createAccount(payload, 'admin', 'ana')
  await createAccount(payload, 'editor', 'ed')
  await createAccount(payload, 'resident', 'rita')
  await createAccount(payload, 'agent', 'scout')
}, 60_000)

const roles = async () => {
  const { docs } = await payload.find({
    collection: 'users',
    depth: 0,
    limit: 10,
    sort: 'id',
    overrideAccess: true,
  })
  return docs.map((doc) => doc.role)
}

const run = async (step: typeof up | typeof down) => {
  const req = await createLocalReq({}, payload)
  await step({ db: payload.db.drizzle, payload, req } as unknown as MigrateUpArgs & MigrateDownArgs)
}

describe('the guest role migration', () => {
  it('turns residents into guests and leaves other roles alone', async () => {
    expect(await roles()).toEqual(['admin', 'editor', 'resident', 'agent'])
    await run(up)
    expect(await roles()).toEqual(['admin', 'editor', 'guest', 'agent'])
  })

  it('turns guests back into residents on the way down', async () => {
    await run(down)
    expect(await roles()).toEqual(['admin', 'editor', 'resident', 'agent'])
  })
})
