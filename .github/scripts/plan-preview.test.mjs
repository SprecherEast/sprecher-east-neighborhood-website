import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const SCRIPTS = path.dirname(fileURLToPath(import.meta.url))
const PREVIEW = path.join(SCRIPTS, 'plan-preview.sh')
const DEPLOY = path.join(SCRIPTS, 'plan-deploy.sh')

let dir
let repo
let output
let summary

const git = (...args) => {
  const r = spawnSync('git', args, { cwd: repo, encoding: 'utf8' })
  if (r.status !== 0) throw new Error(r.stderr)
  return r.stdout.trim()
}

/** Commits `files` (path → text) on a branch from `main` and returns its tip. */
function commit(branch, files) {
  git('checkout', '-q', '-B', branch, 'main')
  for (const [name, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(repo, name)), { recursive: true })
    fs.writeFileSync(path.join(repo, name), text)
  }
  git('add', '-A')
  git('commit', '-q', '-m', branch)
  return git('rev-parse', 'HEAD')
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plan-preview-'))
  repo = path.join(dir, 'repo')
  fs.mkdirSync(repo)
  git('init', '-q', '-b', 'main')
  git('config', 'user.email', 'test@example.com')
  git('config', 'user.name', 'Test')
  fs.writeFileSync(path.join(repo, 'README.md'), 'hello\n')
  git('add', '-A')
  git('commit', '-q', '-m', 'base')
  output = path.join(dir, 'out')
  summary = path.join(dir, 'summary')
  fs.writeFileSync(output, '')
  fs.writeFileSync(summary, '')
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

function run(files, env = {}) {
  const base = git('rev-parse', 'main')
  const head = commit('feature', files)
  const result = spawnSync('bash', [PREVIEW], {
    cwd: repo,
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      HEAD_REPO: 'Org/site',
      BASE_REPO: 'Org/site',
      PR_AUTHOR: 'someone',
      HAS_LABEL: 'true',
      BASE_SHA: base,
      HEAD_SHA: head,
      GITHUB_OUTPUT: output,
      GITHUB_STEP_SUMMARY: summary,
      ...env,
    },
  })
  return {
    code: result.status,
    out: result.stdout + result.stderr,
    written: fs.readFileSync(output, 'utf8'),
    summary: fs.readFileSync(summary, 'utf8'),
  }
}

const CODE = { 'src/page.tsx': 'export {}\n' }

describe('plan-preview.sh', () => {
  it('builds a preview for a same-repository pull request that changes code and has the label', () => {
    const r = run(CODE)
    expect(r.code).toBe(0)
    expect(r.written).toBe('build=true\n')
  })

  it('compares a pull request against the commit it branched from, not against main as it is now', () => {
    // main moves on with code after the branch is made; base.sha is main's tip then, not an ancestor of the head
    git('checkout', '-q', '-b', 'feature')
    fs.writeFileSync(path.join(repo, 'notes.md'), 'docs only\n')
    git('add', '-A')
    git('commit', '-q', '-m', 'docs')
    const head = git('rev-parse', 'HEAD')
    git('checkout', '-q', 'main')
    fs.mkdirSync(path.join(repo, 'src'))
    fs.writeFileSync(path.join(repo, 'src/new.ts'), 'export {}\n')
    git('add', '-A')
    git('commit', '-q', '-m', 'code on main')
    const base = git('rev-parse', 'main')
    const r = spawnSync('bash', [PREVIEW], {
      cwd: repo,
      encoding: 'utf8',
      env: {
        PATH: process.env.PATH,
        HEAD_REPO: 'Org/site',
        BASE_REPO: 'Org/site',
        PR_AUTHOR: 'someone',
        HAS_LABEL: 'true',
        BASE_SHA: base,
        HEAD_SHA: head,
        GITHUB_OUTPUT: output,
      },
    })
    expect(r.status).toBe(0)
    expect(fs.readFileSync(output, 'utf8')).toBe('build=false\n')
  })

  it.each([
    ['a fork', { HEAD_REPO: 'someone-else/site' }, 'comes from a fork'],
    ['Dependabot', { PR_AUTHOR: 'dependabot[bot]' }, 'Dependabot'],
  ])('gives %s no preview, with a summary saying why', (_name, env, reason) => {
    const r = run(CODE, env)
    expect(r.code).toBe(0)
    expect(r.written).toBe('build=false\n')
    expect(r.summary).toContain(reason)
    expect(r.out).toContain('::notice title=Pull request preview::No preview')
  })

  it('counts a pull request whose head repository is gone as a fork', () => {
    const r = run(CODE, { HEAD_REPO: '' })
    expect(r.written).toBe('build=false\n')
    expect(r.summary).toContain('fork')
  })

  it('compares repository names without regard to letter case', () => {
    expect(run(CODE, { HEAD_REPO: 'org/SITE' }).written).toBe('build=true\n')
  })

  it.each([
    ['documentation', { 'docs/guide.md': 'x\n', 'AGENTS.md': 'y\n' }],
    ['repository tooling', { '.github/workflows/x.yml': 'x\n', '.claude/a.json': '{}\n' }],
    ['a license', { LICENSE: 'MIT\n' }],
  ])('gives a pull request that changes only %s no preview, even with the label', (_n, files) => {
    const r = run(files)
    expect(r.written).toBe('build=false\n')
    expect(r.summary).toContain('only docs and repository tooling')
  })

  it('builds when one changed file reaches the server among docs', () => {
    const r = run({ ...CODE, 'docs/a.md': 'x\n' })
    expect(r.written).toBe('build=true\n')
  })

  it('gives a code pull request without the label no preview and says how to get one', () => {
    const r = run(CODE, { HAS_LABEL: 'false' })
    expect(r.written).toBe('build=false\n')
    expect(r.summary).toContain('`preview` label')
  })

  it.each(['', 'yes', 'TRUE', '1'])('takes only the word true as the label (%j)', (value) => {
    expect(run(CODE, { HAS_LABEL: value }).written).toBe('build=false\n')
  })

  it('says the fork reason before the label reason', () => {
    const r = run(CODE, { HEAD_REPO: 'x/y', HAS_LABEL: 'false' })
    expect(r.summary).toContain('fork')
  })
})

describe('plan-deploy.sh reads the same list of files', () => {
  /** Runs the production plan for a commit that changes `files` on top of a live one. */
  function plan(files) {
    const live = git('rev-parse', 'main')
    const sha = commit('next', files)
    git('checkout', '-q', 'next')
    const r = spawnSync('bash', [DEPLOY], {
      cwd: repo,
      encoding: 'utf8',
      env: { PATH: process.env.PATH, SHA: sha, DEPLOYED: live, GITHUB_OUTPUT: output },
    })
    return { code: r.status, written: fs.readFileSync(output, 'utf8') }
  }

  it('skips a push that changes only docs and repository tooling', () => {
    expect(plan({ 'docs/a.md': 'x\n', '.github/a.yml': 'x\n' }).written).toContain('deploy=false')
  })

  it('deploys a push that changes code', () => {
    expect(plan({ 'src/a.ts': 'x\n', 'docs/a.md': 'x\n' }).written).toContain('deploy=true')
  })
})
