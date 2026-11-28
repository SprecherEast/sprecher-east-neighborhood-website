/**
 * The generated reference is build output, so it stays out of git (#1594, the owner's direction of
 * 2026-11-28, voice: generated build output leaves git). These tests keep it that way and keep it
 * buildable from a fresh clone: ignored, built before anything that reads it, built (and failed on)
 * in CI, and every note that links into it says how to build it.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'
import { describe, expect, it } from 'vitest'

const root = path.resolve(import.meta.dirname, '../..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const pkg = JSON.parse(read('package.json'))
const ci = yaml.load(read('.github/workflows/ci.yml'))
const stepsOf = (job) => ci.jobs[job].steps.map((step) => step.run ?? '')

const REGISTRY = 'src/platform/ui/showcaseRegistry.ts'
const ENSURE = 'node scripts/ensure-reference.mjs'

const trackedFiles = () => {
  try {
    return execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
      .split('\0')
      .filter(Boolean)
  } catch {
    return null // not a git checkout (an exported copy): nothing to compare
  }
}

describe('the reference is not in git', () => {
  it('is ignored, with its import map', () => {
    const ignored = read('.gitignore').split('\n')
    expect(ignored).toContain('/docs/reference/')
    expect(ignored).toContain(`/${REGISTRY}`)
  })

  it('has no tracked file', () => {
    const files = trackedFiles()
    if (!files) return
    expect(files.filter((f) => f.startsWith('docs/reference/') || f === REGISTRY)).toEqual([])
  })
})

describe('the reference is built where it is read', () => {
  it('has one build command and no check against a committed copy', () => {
    expect(pkg.scripts['docs:generate']).toContain('scripts/generate-reference.mjs')
    expect(pkg.scripts['docs:check']).toBeUndefined()
    expect(read('scripts/generate-reference.mjs')).not.toContain('--check')
  })

  it.each([
    'pretest',
    'prebuild',
    'predev',
    'pretypecheck',
    'predeveloper:dev',
    'predeveloper:build',
    'preknowledge:structure',
    'preknowledge:map',
  ])('builds it first for %s when it is missing', (hook) => {
    expect(pkg.scripts[hook]).toBe(ENSURE)
  })

  it('type-checks through one command, so a fresh clone and CI do the same', () => {
    expect(pkg.scripts.typecheck).toBe('next typegen && tsc --noEmit')
    expect(stepsOf('build').join('\n')).toContain('npm run typecheck')
  })

  it('builds it in the Knowledge sync job and lets the build fail the job', () => {
    const steps = ci.jobs['knowledge-sync'].steps
    const build = steps.find((step) => step.run?.includes('docs:generate'))
    expect(build).toBeDefined()
    expect(build['continue-on-error']).toBeUndefined()
    expect(JSON.stringify(ci)).not.toContain('docs:check')
  })

  it('is built before the jobs that read it do their work', () => {
    // The knowledge notes' structure check and the map scan read the pages, and each has its hook
    const run = stepsOf('knowledge-sync')
    const at = (text) => run.findIndex((step) => step.includes(text))
    expect(at('docs:generate')).toBeGreaterThan(-1)
    expect(at('docs:generate')).toBeLessThan(at('knowledge:structure'))
    expect(at('docs:generate')).toBeLessThan(at('knowledge:map'))
  })
})

describe('the checks that resolve imports build it first', () => {
  const lint = yaml.load(read('.github/workflows/lint.yml'))
  const runs = (steps) => steps.map((step) => step.run ?? '')
  const before = (steps, tool) => {
    const all = runs(steps)
    const built = all.findIndex(
      (run) => run.includes('ensure-reference') || run.includes('docs:generate'),
    )
    return built > -1 && built < all.findIndex((run) => run.includes(tool))
  }

  it('builds it before ESLint reads the test that imports the import map', () => {
    expect(before(lint.jobs.eslint.steps, 'eslint')).toBe(true)
  })

  it('builds it before knip looks for the import map', () => {
    expect(before(ci.jobs.knip.steps, 'npm run knip')).toBe(true)
  })
})

describe('the jobs that build it run a Node the build supports', () => {
  // Loading the Payload config needs Node 22 (the build fails on 20): the other jobs that load it
  // already use it, and so does the server the release is built for
  const lint = yaml.load(read('.github/workflows/lint.yml'))
  const nodeOf = (job) =>
    job.steps.find((step) => step.uses?.startsWith('actions/setup-node'))?.with['node-version']

  it.each([
    ['Type-check & Build', ci.jobs.build],
    ['ESLint', lint.jobs.eslint],
    ['Unused code (knip)', ci.jobs.knip],
    ['Knowledge sync', ci.jobs['knowledge-sync']],
  ])('%s uses Node 22', (_name, job) => {
    expect(nodeOf(job)).toBe(22)
  })
})

describe('every note that links into the reference says how to build it', () => {
  const linksIntoReference = /\]\([^)]*(?:docs\/reference|\.\.\/reference)\//

  it('names `npm run docs:generate` in each', () => {
    const files = trackedFiles()
    if (!files) return
    const notes = files
      .filter((f) => f.endsWith('.md') && !f.startsWith('docs/reference/'))
      .filter((f) => !f.startsWith('docs/architecture/decisions/'))
      .filter((f) => linksIntoReference.test(read(f)))
    expect(notes.length).toBeGreaterThan(0)
    const missing = notes.filter((f) => !read(f).includes('npm run docs:generate'))
    expect(missing).toEqual([])
  })
})
