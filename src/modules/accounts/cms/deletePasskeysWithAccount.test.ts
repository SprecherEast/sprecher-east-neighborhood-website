import type { PayloadRequest } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { deletePasskeysWithAccount } from './deletePasskeysWithAccount'

const run = (id: number | string, deleteMany: ReturnType<typeof vi.fn>) => {
  const req = { payload: { db: { deleteMany } } } as unknown as PayloadRequest
  return { req, done: deletePasskeysWithAccount({ id, req, collection: {} as never, context: {} }) }
}

describe('deletePasskeysWithAccount (#1313)', () => {
  it('deletes the account’s passkeys and its open challenges, before the account goes', async () => {
    const deleteMany = vi.fn(async () => undefined)
    const { req, done } = run(7, deleteMany)
    await done
    expect(deleteMany).toHaveBeenCalledTimes(2)
    expect(deleteMany).toHaveBeenCalledWith({
      collection: 'passkeys',
      where: { account: { equals: 7 } },
      req,
    })
    expect(deleteMany).toHaveBeenCalledWith({
      collection: 'passkey-challenges',
      where: { account: { equals: 7 } },
      req,
    })
  })

  it('does not hide a failure: the account’s delete stops with it', async () => {
    const deleteMany = vi.fn(async () => {
      throw new Error('database is locked')
    })
    await expect(run(7, deleteMany).done).rejects.toThrow('database is locked')
  })
})
