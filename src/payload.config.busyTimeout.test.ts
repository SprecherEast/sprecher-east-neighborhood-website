import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import type { Client } from '@libsql/client'
import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { SQLITE_BUSY_TIMEOUT_MS } from '@/platform/payload/sqliteBusyTimeout'
import { bootPayload, createAccount } from '@/platform/payload/testing/inMemoryPayload'

/**
 * The database waits for a short lock instead of failing at once (#153, #1147). The deploy's
 * migration step and the running site both hit `SQLITE_BUSY` at busy timeout 0.
 *
 * The timeout is set once, on the connection made at connect. libsql hands that connection to
 * each transaction and opens a new one with no timeout afterwards (checked: 5000 before a real
 * transaction, 0 after). This site runs no database transactions (no `transactionOptions`, so
 * Payload's begin-transaction does nothing), so the connection is never swapped and the timeout
 * lasts. The guard below fails if transactions are turned on; then the timeout would need WAL or
 * to be set on every new connection (#1326). The lock holder is another process, because libsql
 * waits synchronously and would block its own releaser.
 */

const HOLD_MS = 1500

let payload: Payload
let folder: string
let file: string

/** Another process takes the write lock on the database file, says so, and keeps it for `HOLD_MS`. */
function holdWriteLock(): Promise<void> {
  const script = `
    const { createClient } = require('@libsql/client')
    const db = createClient({ url: 'file:' + process.argv[1] })
    db.execute('BEGIN IMMEDIATE').then(() => {
      console.log('locked')
      setTimeout(() => db.execute('COMMIT').then(() => process.exit(0)), ${HOLD_MS})
    })
  `
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', script, file], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'inherit'],
    })
    child.stdout.once('data', () => resolve())
    child.once('error', reject)
    child.once('exit', (code) => code && reject(new Error(`lock holder exited with ${code}`)))
  })
}

beforeAll(async () => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'busy-timeout-'))
  file = path.join(folder, 'test.db')
  ;({ payload } = await bootPayload(`file:${file}`))
}, 120_000)

afterAll(() => {
  fs.rmSync(folder, { recursive: true, force: true })
})

describe('the database busy timeout', () => {
  it('is set on the adapter from the one named constant', () => {
    expect(SQLITE_BUSY_TIMEOUT_MS).toBeGreaterThan(0)
    expect(SQLITE_BUSY_TIMEOUT_MS).toBeLessThanOrEqual(10_000)
    expect((payload.db as unknown as { busyTimeout: number }).busyTimeout).toBe(
      SQLITE_BUSY_TIMEOUT_MS,
    )
  })

  it('runs no database transactions, which is why the timeout is never lost', async () => {
    const db = payload.db as unknown as {
      transactionOptions?: unknown
      client: Client & { transaction: Client['transaction'] }
    }
    expect(db.transactionOptions).toBeUndefined()
    expect(await payload.db.beginTransaction()).toBeNull()

    const transaction = vi.spyOn(db.client, 'transaction')
    await createAccount(payload, 'admin', 'first')
    await createAccount(payload, 'editor', 'second')
    expect(transaction).not.toHaveBeenCalled()

    const { rows } = await db.client.execute('PRAGMA busy_timeout')
    expect(Number(rows[0]?.[0] ?? rows[0]?.timeout)).toBe(SQLITE_BUSY_TIMEOUT_MS)
  })

  it('makes a write wait for another process holding the write lock, then succeed', async () => {
    await holdWriteLock()
    const started = Date.now()
    await createAccount(payload, 'editor', 'third')
    expect(Date.now() - started).toBeGreaterThan(HOLD_MS / 2)
  })
})
