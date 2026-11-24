/**
 * The entry script of the reference (#1461), run as a program on a copy of the repository: what
 * `--check` says and exits with, and what a write does to a stale, missing or stray page. It
 * takes about two minutes, since each run loads the Payload config and reads all of `src/`.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const source = path.resolve(import.meta.dirname, '../..')
const FOLDERS = ['src', 'scripts', 'docs', 'ops', 'public', 'intelligence', '.github', 'data']
let copy

const run = (...args) =>
  spawnSync(
    path.join(source, 'node_modules/.bin/tsx'),
    ['--tsconfig', 'tsconfig.json', 'scripts/generate-reference.mjs', ...args],
    { cwd: copy, encoding: 'utf8', timeout: 300_000 },
  )
const pagesOf = () =>
  fs
    .readdirSync(path.join(copy, 'docs/reference'), { recursive: true })
    .filter((f) => f.endsWith('.md'))
const read = (file) => fs.readFileSync(path.join(copy, 'docs/reference', file), 'utf8')

beforeAll(() => {
  copy = fs.mkdtempSync(path.join(os.tmpdir(), 'sena1461-generate-'))
  for (const folder of FOLDERS) {
    if (fs.existsSync(path.join(source, folder))) {
      fs.cpSync(path.join(source, folder), path.join(copy, folder), { recursive: true })
    }
  }
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (entry.isFile()) fs.copyFileSync(path.join(source, entry.name), path.join(copy, entry.name))
  }
  fs.symlinkSync(path.join(source, 'node_modules'), path.join(copy, 'node_modules'))
}, 120_000)

afterAll(() => fs.rmSync(copy, { recursive: true, force: true }))

describe('scripts/generate-reference.mjs', () => {
  it('checks, fails on a stale, missing or stray page, and writes them right', () => {
    const current = run('--check')
    expect(current.status, current.stderr).toBe(0)
    expect(current.stdout).toContain(`docs/reference is current (${pagesOf().length} pages, `)

    const original = { jobs: read('jobs.md'), endpoints: read('endpoints.md') }
    fs.rmSync(path.join(copy, 'docs/reference/jobs.md'))
    fs.appendFileSync(path.join(copy, 'docs/reference/endpoints.md'), 'stale\n')
    fs.writeFileSync(path.join(copy, 'docs/reference/stray.md'), 'stray\n')
    const stale = run('--check')
    expect(stale.status).toBe(1)
    for (const name of ['jobs.md', 'endpoints.md', 'stray.md']) expect(stale.stderr).toContain(name)

    const written = run()
    expect(written.status, written.stderr).toBe(0)
    expect(written.stdout).toContain(`Wrote ${pagesOf().length} pages to docs/reference (`)
    expect(read('jobs.md')).toBe(original.jobs)
    expect(read('endpoints.md')).toBe(original.endpoints)
    expect(fs.existsSync(path.join(copy, 'docs/reference/stray.md'))).toBe(false)
    expect(run('--check').status).toBe(0)
  }, 600_000)
})
