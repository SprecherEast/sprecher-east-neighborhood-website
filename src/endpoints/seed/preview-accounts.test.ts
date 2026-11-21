import { randomBytes } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  PREVIEW_ACCOUNT_ROLES,
  parsePreviewPasswords,
  previewAccountEmail,
  readPreviewPasswords,
} from './preview-accounts'

/**
 * The test accounts of a pull request preview (#1393): one per role that signs in with a password, with
 * a random password per deploy that the deploy script (ops/preview-accounts.sh) writes to a private file
 * and this code reads. No value may ever reach an error message: a deploy log is public.
 */

const secret = () => randomBytes(32).toString('hex')
const fileText = (passwords: Record<string, string>) =>
  Object.entries(passwords)
    .map(([role, password]) => `${role}=${password}\n`)
    .join('')
const good = () => Object.fromEntries(PREVIEW_ACCOUNT_ROLES.map((role) => [role, secret()]))

describe('the roles', () => {
  it('are the ones that sign in with a password: admin, editor, resident and guest, never the agent', () => {
    expect([...PREVIEW_ACCOUNT_ROLES]).toEqual(['admin', 'editor', 'resident', 'guest'])
  })

  it('have an example.com address each, and no two share one', () => {
    const emails = PREVIEW_ACCOUNT_ROLES.map(previewAccountEmail)
    expect(new Set(emails).size).toBe(emails.length)
    for (const email of emails) expect(email).toMatch(/^[a-z-]+@example\.com$/)
  })
})

describe('parsePreviewPasswords', () => {
  it('reads one password per role', () => {
    const passwords = good()
    expect(parsePreviewPasswords(fileText(passwords))).toEqual(passwords)
  })

  const mistakes: Array<[string, (p: Record<string, string>) => string]> = [
    ['a missing role', ({ admin, editor, resident }) => fileText({ admin, editor, resident })],
    ['a role with no account here (the agent)', (p) => fileText({ ...p, agent: secret() })],
    ['a short password', (p) => fileText({ ...p, guest: 'short' })],
    ['a password in capitals', (p) => fileText({ ...p, guest: secret().toUpperCase() })],
    ['a repeated role', (p) => `${fileText(p)}admin=${secret()}\n`],
    ['one password for two roles', (p) => fileText({ ...p, guest: p.resident })],
    ['a stray line', (p) => `${fileText(p)}# note\n`],
    ['spaces around the equals sign', (p) => fileText(p).replace('admin=', 'admin = ')],
    ['nothing at all', () => ''],
  ]
  it.each(mistakes)('refuses %s, and the message holds no password', (_name, make) => {
    const passwords = good()
    let message = ''
    try {
      parsePreviewPasswords(make(passwords))
    } catch (error) {
      message = (error as Error).message
    }
    expect(message).not.toBe('')
    for (const password of Object.values(passwords)) expect(message).not.toContain(password)
  })
})

describe('readPreviewPasswords', () => {
  let dir = ''
  const file = () => path.join(dir, 'accounts')
  const write = (text: string, mode = 0o600) => fs.writeFileSync(file(), text, { mode })
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'preview-accounts-'))
  })
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

  it('reads a private file the deploy wrote', () => {
    const passwords = good()
    write(fileText(passwords))
    fs.chmodSync(file(), 0o600) // the process umask may have narrowed it
    expect(readPreviewPasswords(file())).toEqual(passwords)
  })

  it.each([undefined, ''])('refuses no path (%j)', (value) => {
    expect(() => readPreviewPasswords(value)).toThrow('PREVIEW_ACCOUNTS_FILE')
  })

  it('refuses a file that is missing', () => {
    expect(() => readPreviewPasswords(file())).toThrow()
  })

  it.each([0o644, 0o640, 0o604, 0o660])('refuses a file others can open (mode %o)', (mode) => {
    const passwords = good()
    write(fileText(passwords))
    fs.chmodSync(file(), mode)
    let message = ''
    try {
      readPreviewPasswords(file())
    } catch (error) {
      message = (error as Error).message
    }
    expect(message).toContain('private')
    for (const password of Object.values(passwords)) expect(message).not.toContain(password)
  })

  it('refuses a private file that belongs to another user', () => {
    write(fileText(good()))
    fs.chmodSync(file(), 0o600)
    const me = process.getuid?.() ?? 0
    const spy = vi.spyOn(process, 'getuid').mockReturnValue(me + 1)
    try {
      expect(() => readPreviewPasswords(file())).toThrow('private file')
    } finally {
      spy.mockRestore()
    }
    expect(Object.keys(readPreviewPasswords(file()))).toHaveLength(4) // and its own user reads it
  })

  it('refuses a link, even to a private file', () => {
    write(fileText(good()))
    fs.symlinkSync(file(), path.join(dir, 'link'))
    expect(() => readPreviewPasswords(path.join(dir, 'link'))).toThrow()
  })
})
