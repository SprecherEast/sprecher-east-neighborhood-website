import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import type { Client } from '@libsql/client'
import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { SQLITE_BUSY_TIMEOUT_MS } from '@/platform/payload/sqliteBusyTimeout'
import { bootPayload, createAccount } from '@/platform/payload/testing/inMemoryPayload'

/**
 * The database waits for a short lock instead of failing at once (#153, #1147). The deploy's
 * migration step and the running site both hit `SQLITE_BUSY` at busy timeout 0. The risk raised
 * on #153: libsql hands its connection to each transaction and opens a new one afterwards, so
 * the timeout set once at connect might not reach later connections. These tests hold a write
 * lock from another process (libsql waits synchronously, so the holder cannot share the
 * process) and write through Payload after earlier transactions.
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

  it('still applies to a write after earlier transactions, and waits for the lock', async () => {
    // Each create is a transaction, so libsql has swapped connections more than once by now.
    await createAccount(payload, 'admin', 'first')
    await createAccount(payload, 'editor', 'second')

    // The connection the client now holds is a new one, and it carries the timeout.
    const client = (payload.db as unknown as { client: Client }).client
    const { rows } = await client.execute('PRAGMA busy_timeout')
    expect(Number(rows[0]?.[0] ?? rows[0]?.timeout)).toBe(SQLITE_BUSY_TIMEOUT_MS)

    await holdWriteLock()
    const started = Date.now()
    await createAccount(payload, 'editor', 'third')
    expect(Date.now() - started).toBeGreaterThan(HOLD_MS / 2)
  })
})
