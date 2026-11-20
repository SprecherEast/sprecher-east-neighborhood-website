import type { PayloadRequest } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { passkeyRemovedNote } from './passkeyRemovedNote'

const findOne = vi.fn()
const sendEmail = vi.fn()
const error = vi.fn()
const req = {
  payload: { db: { findOne }, sendEmail, logger: { error } },
} as unknown as PayloadRequest
const run = (doc: Record<string, unknown>) =>
  passkeyRemovedNote({ doc, id: 12, req, collection: {} as never, context: {} })

beforeEach(() => {
  findOne.mockReset().mockResolvedValue({ email: 'ada@example.com' })
  sendEmail.mockReset().mockResolvedValue(undefined)
  error.mockReset()
})

describe('passkeyRemovedNote (#1316)', () => {
  it('emails the owning account the label and the time, with no link', async () => {
    await run({ id: 12, account: 7, label: 'My phone' })
    expect(findOne).toHaveBeenCalledWith({ collection: 'users', where: { id: { equals: 7 } } })
    const mail = sendEmail.mock.calls[0]?.[0]
    expect(mail.to).toBe('ada@example.com')
    expect(mail.subject).toBe('A passkey was removed from your account')
    expect(mail.text).toContain('“My phone”')
    expect(mail.text + mail.html).not.toMatch(/https?:|href=/)
  })

  it('reads the account from a populated relationship too', async () => {
    await run({ id: 12, account: { id: 9 }, label: 'Key' })
    expect(findOne).toHaveBeenCalledWith({ collection: 'users', where: { id: { equals: 9 } } })
  })

  it.each([
    ['no account on the row', { id: 12, label: 'x' }, { email: 'a@example.com' }],
    ['an account that is gone', { id: 12, account: 7, label: 'x' }, null],
    ['an account without an address', { id: 12, account: 7, label: 'x' }, { email: '' }],
  ])('sends nothing for %s', async (_name, doc, owner) => {
    findOne.mockResolvedValue(owner)
    await run(doc)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('never throws when the note fails: the passkey is already gone', async () => {
    sendEmail.mockRejectedValue(new Error('smtp down'))
    await expect(run({ id: 12, account: 7, label: 'x' })).resolves.toBeUndefined()
    findOne.mockRejectedValue(new Error('db down'))
    await expect(run({ id: 12, account: 7, label: 'x' })).resolves.toBeUndefined()
    expect(error).toHaveBeenCalledTimes(2)
  })

  it('logs only the error’s class name, never its message', async () => {
    sendEmail.mockRejectedValue(new Error('smtp refused ada@example.com'))
    await run({ id: 12, account: 7, label: 'x' })
    expect(error).toHaveBeenCalledExactlyOnceWith('Passkey removed note failed (Error)')
  })
})
