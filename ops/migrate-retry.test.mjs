// run_migrate in lib.sh (#1147): `payload migrate` is tried once more only when a failure says
// SQLITE_BUSY; any other failure, and a second failure, return 1 so deploy-release.sh stops with
// the live site unchanged. A stub `payload` stands in for the real one and counts its runs.
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

/** Runs run_migrate against a stub `payload` whose n-th run prints line n of `outputs` and fails unless that line is "ok". */
function migrate(outputs) {
  write(
    `${dir}/rel/node_modules/.bin/payload`,
    `#!/usr/bin/env bash
n=$(($(cat "${dir}/runs" 2>/dev/null || echo 0) + 1))
echo "$n" > "${dir}/runs"
line=$(sed -n "\${n}p" "${dir}/outputs")
echo "$line"
[ "$line" = ok ]
`,
    0o755,
  )
  fs.writeFileSync(`${dir}/outputs`, outputs.join('\n') + '\n')
  const result = spawnSync(
    'bash',
    ['-c', `set -Eeuo pipefail; . "${OPS}/lib.sh"; run_migrate "${dir}/rel"`],
    { encoding: 'utf8', env: { ...process.env, MIGRATE_RETRY_SECONDS: '0' } },
  )
  const runs = Number(fs.readFileSync(`${dir}/runs`, 'utf8'))
  return { code: result.status, out: result.stdout, runs }
}

describe('run_migrate', () => {
  it('runs once when the migration passes', () => {
    expect(migrate(['ok'])).toMatchObject({ code: 0, runs: 1 })
  })

  it('tries once more after SQLITE_BUSY, and passes if the second run does', () => {
    const result = migrate(['SQLITE_BUSY: database is locked', 'ok'])
    expect(result).toMatchObject({ code: 0, runs: 2 })
    expect(result.out).toContain('database was busy')
  })

  it('fails after a second SQLITE_BUSY, with no third run', () => {
    expect(migrate(['SQLITE_BUSY: database is locked', 'SQLITE_BUSY again'])).toMatchObject({
      code: 1,
      runs: 2,
    })
  })

  it('does not retry another failure', () => {
    expect(migrate(['syntax error in migration', 'ok'])).toMatchObject({ code: 1, runs: 1 })
  })
})
