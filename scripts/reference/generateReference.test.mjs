/**
 * The entry script of the reference (#1461), run as a program on a small repository (two content
 * types, an endpoint, a tool, a job and a timer: `entryFixture.mjs`): what a build does to a stale,
 * missing or stray page. The real tree is built by the `Knowledge sync` job (`docs:generate`, which
 * fails when the build fails, #1594), so this test stays fast enough for the full suite.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildEntryFixture } from './entryFixture.mjs'

// The showcase's import map (#1532) is generated into the kit's folder, not into docs/reference/
const REGISTRY = 'src/platform/ui/showcaseRegistry.ts'
const source = path.resolve(import.meta.dirname, '../..')
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
/** What a run says, so a failure on another machine can be read from the log. */
const describeRun = (result) =>
  `status ${result.status}, signal ${result.signal}, error ${result.error?.message}\n` +
  `stdout: ${result.stdout?.slice(-1500)}\nstderr: ${result.stderr?.slice(-3000)}`
const pagesOf = () =>
  fs
    .readdirSync(path.join(copy, 'docs/reference'), { recursive: true })
    .filter((f) => f.endsWith('.md') || f === 'showcase-index.json')
const read = (file) => fs.readFileSync(path.join(copy, 'docs/reference', file), 'utf8')

beforeAll(() => {
  copy = fs.mkdtempSync(path.join(os.tmpdir(), 'sena1461-generate-'))
  fs.mkdirSync(path.join(copy, '.tmp'))
  buildEntryFixture(source, copy)
}, 120_000)

afterAll(() => fs.rmSync(copy, { recursive: true, force: true }))

describe('scripts/generate-reference.mjs', () => {
  it('builds every page and the import map, and rebuilds a stale, missing or stray page right', () => {
    // A repository with nothing built yet: a run makes every page
    const first = run()
    expect(first.status, describeRun(first)).toBe(0)
    expect(first.stdout).toContain(`Wrote ${pagesOf().length} pages to docs/reference (`)

    // the tool passes a collection to a helper: the loader tells the tool reader which collections exist
    expect(read('mcp-tools.md')).toMatch(/echo[\s\S]*events/)

    // the showcase index (#1532) is written like a page
    expect(JSON.parse(read('showcase-index.json')).coverage).toMatchObject({
      total: expect.any(Number),
    })

    // a file that is not a Markdown page is left alone by a build
    fs.writeFileSync(path.join(copy, 'docs/reference/notes.txt'), 'kept\n')

    const original = {
      jobs: read('jobs.md'),
      endpoints: read('endpoints.md'),
      index: read('showcase-index.json'),
      registry: fs.readFileSync(path.join(copy, REGISTRY), 'utf8'),
    }
    fs.appendFileSync(path.join(copy, 'docs/reference/showcase-index.json'), ' \n')
    fs.appendFileSync(path.join(copy, REGISTRY), '// stale\n')
    fs.rmSync(path.join(copy, 'docs/reference/jobs.md'))
    fs.appendFileSync(path.join(copy, 'docs/reference/endpoints.md'), 'stale\n')
    fs.writeFileSync(path.join(copy, 'docs/reference/stray.md'), 'stray\n')

    const rebuilt = run()
    expect(rebuilt.status, describeRun(rebuilt)).toBe(0)
    expect(rebuilt.stdout).toContain(`Wrote ${pagesOf().length} pages to docs/reference (`)
    expect(read('jobs.md')).toBe(original.jobs)
    expect(read('endpoints.md')).toBe(original.endpoints)
    expect(read('showcase-index.json')).toBe(original.index)
    expect(fs.readFileSync(path.join(copy, REGISTRY), 'utf8')).toBe(original.registry)
    expect(fs.existsSync(path.join(copy, 'docs/reference/stray.md'))).toBe(false)
    expect(read('notes.txt')).toBe('kept\n')
  }, 600_000)
})
