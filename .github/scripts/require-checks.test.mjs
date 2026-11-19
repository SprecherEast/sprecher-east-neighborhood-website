import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'require-checks.sh')

// Every check the main ruleset requires and that runs on a push to main (#868). `PR Policy` runs on
// pull requests only, and the end-to-end tests are not required yet.
const DEPLOY_SET = [
  'Type-check & Build',
  'Prettier',
  'ESLint',
  'Dependency Audit',
  'Knowledge sync',
  'Agent context',
]

let dir

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'require-checks-'))
  // A stand-in for the GitHub CLI: one push run whose jobs come from $FAKE_JOBS (tab-separated
  // name, status, conclusion), and main's head from $FAKE_HEAD.
  fs.writeFileSync(
    path.join(dir, 'gh'),
    `#!/usr/bin/env bash
case "$2" in
  *"/actions/runs?"*) echo 1 ;;
  *"/jobs?"*) printf '%b' "$FAKE_JOBS" ;;
  *"/commits/main") echo "$FAKE_HEAD" ;;
esac
`,
    { mode: 0o755 },
  )
})

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }))

const jobs = (entries) =>
  entries.map(([name, status, conclusion]) => `${name}\t${status}\t${conclusion}\n`).join('')

const allSuccess = () => DEPLOY_SET.map((name) => [name, 'completed', 'success'])

function run(entries, env = {}) {
  const result = spawnSync('bash', [SCRIPT], {
    encoding: 'utf8',
    env: {
      PATH: `${dir}:${process.env.PATH}`,
      GH_TOKEN: 'x',
      REPO: 'o/r',
      SHA: 'abc1234',
      FAKE_HEAD: 'abc1234',
      TIMEOUT_SECONDS: '0',
      FAKE_JOBS: jobs(entries).replace(/\n/g, '\\n').replace(/\t/g, '\\t'),
      ...env,
    },
  })
  return { code: result.status, out: result.stdout + result.stderr }
}

describe('require-checks.sh', () => {
  it('lets the deploy go when every required check passed', () => {
    expect(run(allSuccess()).code).toBe(0)
  })

  it('stops the deploy when a required check failed', () => {
    const entries = allSuccess().map(([n, s, c]) => [n, s, n === 'Agent context' ? 'failure' : c])
    const { code, out } = run(entries)
    expect(code).toBe(1)
    expect(out).toContain('Agent context finished with')
  })

  it.each(DEPLOY_SET)('stops the deploy when %s was skipped', (skipped) => {
    const entries = allSuccess().map(([n, s, c]) => [n, s, n === skipped ? 'skipped' : c])
    const { code, out } = run(entries)
    expect(code).toBe(1)
    expect(out).toContain(`${skipped} finished with 'skipped'`)
  })

  it.each(DEPLOY_SET)('stops the deploy when %s never ran', (missing) => {
    const { code, out } = run(allSuccess().filter(([n]) => n !== missing))
    expect(code).toBe(1)
    expect(out).toContain(missing)
    expect(out).toContain('still waiting')
  })

  it('defaults REQUIRED to the same set', () => {
    const script = fs.readFileSync(SCRIPT, 'utf8')
    expect(script).toContain(`REQUIRED="\${REQUIRED:-${DEPLOY_SET.join(',')}}"`)
  })
})
