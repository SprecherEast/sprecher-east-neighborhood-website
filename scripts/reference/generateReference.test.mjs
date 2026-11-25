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

// The script gets its own environment: not the test runner's variables, and its own temporary
// folder, so no other test running at the same time shares a cache or a file with it
const childEnv = () => {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !/^(VITEST|NODE_OPTIONS$)/.test(key)),
  )
  return { ...env, TMPDIR: path.join(copy, '.tmp') }
}

const run = (...args) =>
  spawnSync(
    path.join(source, 'node_modules/.bin/tsx'),
    ['--tsconfig', 'tsconfig.json', 'scripts/generate-reference.mjs', ...args],
    { cwd: copy, env: childEnv(), encoding: 'utf8', timeout: 300_000 },
  )
// TEMPORARY diagnosis (#1461): on a failure, run again with a loader that logs each module it loads
const TRACE_HOOKS = `export async function load(url, context, next) { process.stderr.write('LOAD ' + url + '\\n'); return next(url, context) }\n`
const TRACE = `import { register } from 'node:module'
register('data:text/javascript,' + encodeURIComponent(${JSON.stringify(TRACE_HOOKS)}))
process.on('exit', (code) => process.stderr.write('EXIT ' + code + ' ' + JSON.stringify(process.getActiveResourcesInfo()) + '\\n'))
`
const traced = () => {
  fs.writeFileSync(path.join(copy, '.tmp/trace.mjs'), TRACE)
  const result = spawnSync(
    path.join(source, 'node_modules/.bin/tsx'),
    [
      '--tsconfig',
      'tsconfig.json',
      '--import',
      path.join(copy, '.tmp/trace.mjs'),
      'scripts/generate-reference.mjs',
      '--check',
    ],
    { cwd: copy, env: childEnv(), encoding: 'utf8', timeout: 300_000 },
  )
  return `TRACE status ${result.status}\n${(result.stderr ?? '').split('\n').slice(-25).join('\n')}`
}
/** What a failed run says, so a failure on another machine can be read from the log. */
const describeRun = (result) =>
  (result.status === 13 ? traced() + '\n' : '') +
  `status ${result.status}, signal ${result.signal}, error ${result.error?.message}\n` +
  `stdout: ${result.stdout?.slice(-1500)}\nstderr: ${result.stderr?.slice(-3000)}`
const pagesOf = () =>
  fs
    .readdirSync(path.join(copy, 'docs/reference'), { recursive: true })
    .filter((f) => f.endsWith('.md'))
const read = (file) => fs.readFileSync(path.join(copy, 'docs/reference', file), 'utf8')

beforeAll(() => {
  copy = fs.mkdtempSync(path.join(os.tmpdir(), 'sena1461-generate-'))
  fs.mkdirSync(path.join(copy, '.tmp'))
  // The files git knows (tracked, or new and not ignored): what a fresh checkout holds, with
  // nothing a developer's machine or another test left in the working tree
  const listed = spawnSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    {
      cwd: source,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    },
  )
  if (listed.status !== 0) throw new Error(`git ls-files failed: ${listed.stderr}`)
  for (const file of listed.stdout.split('\0').filter(Boolean)) {
    if (!FOLDERS.includes(file.split('/')[0]) && file.includes('/')) continue
    const from = path.join(source, file)
    if (!fs.existsSync(from)) continue
    fs.mkdirSync(path.dirname(path.join(copy, file)), { recursive: true })
    fs.copyFileSync(from, path.join(copy, file))
  }
  fs.symlinkSync(path.join(source, 'node_modules'), path.join(copy, 'node_modules'))
}, 120_000)

afterAll(() => fs.rmSync(copy, { recursive: true, force: true }))

describe('scripts/generate-reference.mjs', () => {
  it('checks, fails on a stale, missing or stray page, and writes them right', () => {
    const current = run('--check')
    expect(current.status, describeRun(current)).toBe(0)
    expect(current.stdout).toContain(`docs/reference is current (${pagesOf().length} pages, `)

    const original = { jobs: read('jobs.md'), endpoints: read('endpoints.md') }
    fs.rmSync(path.join(copy, 'docs/reference/jobs.md'))
    fs.appendFileSync(path.join(copy, 'docs/reference/endpoints.md'), 'stale\n')
    fs.writeFileSync(path.join(copy, 'docs/reference/stray.md'), 'stray\n')
    const stale = run('--check')
    expect(stale.status, describeRun(stale)).toBe(1)
    for (const name of ['jobs.md', 'endpoints.md', 'stray.md']) expect(stale.stderr).toContain(name)

    const written = run()
    expect(written.status, describeRun(written)).toBe(0)
    expect(written.stdout).toContain(`Wrote ${pagesOf().length} pages to docs/reference (`)
    expect(read('jobs.md')).toBe(original.jobs)
    expect(read('endpoints.md')).toBe(original.endpoints)
    expect(fs.existsSync(path.join(copy, 'docs/reference/stray.md'))).toBe(false)
    const again = run('--check')
    expect(again.status, describeRun(again)).toBe(0)
  }, 600_000)
})
