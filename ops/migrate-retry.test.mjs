// run_migrate in lib.sh (#1147): `payload migrate` is run again only when a failure says
// SQLITE_BUSY and no migration was cut off partway; any other failure, a half-applied migration
// and a last failing run return 1 so deploy-release.sh stops with the live site unchanged. A stub
// `payload` stands in for the real one, printing a prepared output per run and counting its runs.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { OPS, write } from './umami-harness.mjs'

let dir = ''

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migrate-retry-'))
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

const OK = { text: 'Migrated:  20260101_000000 (5ms)', ok: true }
const busy = (text = 'SQLITE_BUSY: database is locked') => ({ text, ok: false })

/**
 * Runs run_migrate against a stub whose n-th run prints `runs[n - 1].text` and succeeds only when
 * its `ok` is true. `shell` is what the calling script has set: the deploy sets `pipefail`.
 */
function migrate(runs, shell = 'set -Eeuo pipefail') {
  write(
    `${dir}/rel/node_modules/.bin/payload`,
    `#!/usr/bin/env bash
n=$(($(cat "${dir}/count" 2>/dev/null || echo 0) + 1))
echo "$n" > "${dir}/count"
cat "${dir}/run.$n"
[ -f "${dir}/ok.$n" ]
`,
    0o755,
  )
  runs.forEach(({ text, ok }, i) => {
    fs.writeFileSync(`${dir}/run.${i + 1}`, `${text}\n`)
    if (ok) fs.writeFileSync(`${dir}/ok.${i + 1}`, '')
  })
  const result = spawnSync(
    'bash',
    ['-c', `${shell}; . "${OPS}/lib.sh"; run_migrate "${dir}/rel"`],
    { encoding: 'utf8', env: { ...process.env, MIGRATE_RETRY_SECONDS: '0' } },
  )
  const count = Number(fs.readFileSync(`${dir}/count`, 'utf8'))
  return { code: result.status, out: result.stdout, count }
}

describe('run_migrate', () => {
  it('runs once when the migration passes', () => {
    expect(migrate([OK])).toMatchObject({ code: 0, count: 1 })
  })

  it('runs again after SQLITE_BUSY before any migration began, and passes if the second run does', () => {
    const result = migrate([busy(), OK])
    expect(result).toMatchObject({ code: 0, count: 2 })
    expect(result.out).toContain('database was busy')
  })

  it('runs again after SQLITE_BUSY between two finished migrations', () => {
    const done = 'Migrating: a\nMigrated:  a (5ms)\nSQLITE_BUSY: database is locked'
    expect(migrate([busy(done), OK])).toMatchObject({ code: 0, count: 2 })
  })

  it('does not run again when a migration was cut off partway (it may be half applied)', () => {
    const cutOff = 'Migrating: a\nMigrated:  a (5ms)\nMigrating: b\nSQLITE_BUSY: database is locked'
    expect(migrate([busy(cutOff), OK])).toMatchObject({ code: 1, count: 1 })
  })

  it('fails after a second SQLITE_BUSY, with no third run', () => {
    expect(migrate([busy(), busy('SQLITE_BUSY again'), OK])).toMatchObject({ code: 1, count: 2 })
  })

  it('does not run again after another failure', () => {
    expect(migrate([busy('syntax error in migration'), OK])).toMatchObject({ code: 1, count: 1 })
  })

  it('reports a failure even when the caller has not set pipefail', () => {
    expect(migrate([busy('syntax error in migration')], 'set +o pipefail')).toMatchObject({
      code: 1,
      count: 1,
    })
  })
})
