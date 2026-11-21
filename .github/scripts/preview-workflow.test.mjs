// The pull request preview workflow's security shape (#1075, #1074): which jobs hold the preview key,
// what they check out and run, what the others can read. The workflow is the pull request's own copy
// on a same-repository pull request, so these checks keep an honest change from putting the key beside
// code nobody has reviewed; the server-side restriction (ops/previews.md) is what holds against a
// dishonest one.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import yaml from 'js-yaml'
import { describe, expect, it } from 'vitest'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const WORKFLOWS = path.join(ROOT, '.github', 'workflows')
const ENVIRONMENT = 'preview'
const KEY_JOBS = ['facts', 'deploy'] // the jobs that hold the preview key
const OTHER_JOBS = ['gate', 'build', 'report']
// The environment's secrets, listed in ops/previews.md. The key line is the only secret among them.
const SECRET_NAMES = [
  'PREVIEW_SSH_HOST',
  'PREVIEW_SSH_USER',
  'PREVIEW_SSH_PORT',
  'PREVIEW_SSH_KEY',
  'PREVIEW_SSH_KNOWN_HOSTS',
]

const read = (name) => fs.readFileSync(path.join(WORKFLOWS, name), 'utf8')
/** The file without its comment lines, which explain what the file must never do. */
const codeOf = (name) =>
  read(name)
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n')
const workflow = yaml.load(read('preview.yml'))
const { jobs } = workflow
const steps = (id) => jobs[id].steps ?? []
const checkouts = (id) =>
  steps(id).filter((s) => String(s.uses ?? '').startsWith('actions/checkout@'))

const secretsRead = (job) =>
  [...JSON.stringify(job).matchAll(/secrets\.([A-Za-z0-9_]+)/g)]
    .map((m) => m[1])
    .filter((n) => n !== 'GITHUB_TOKEN')

describe('the preview workflow’s trigger', () => {
  it('is pull_request, never pull_request_target (which runs with the base repository’s secrets)', () => {
    expect(Object.keys(workflow.on)).toEqual(['pull_request'])
    expect(codeOf('preview.yml')).not.toMatch(/pull_request_target|workflow_run|workflow_call/)
  })

  it('reacts to a push and to the label being added, and to nothing else', () => {
    expect(workflow.on.pull_request.types).toEqual(['opened', 'synchronize', 'reopened', 'labeled'])
  })

  it('has one group per pull request, replacing a deploy in progress, and a label other than `preview` never cancels one', () => {
    expect(workflow.concurrency['cancel-in-progress']).toBe(true)
    expect(workflow.concurrency.group).toContain('github.event.pull_request.number')
    expect(workflow.concurrency.group).toContain('github.run_id') // the unique group of another label
    expect(jobs.gate.if).toContain("github.event.label.name == 'preview'")
  })

  it('has a read-only token by default', () => {
    expect(workflow.permissions).toEqual({ contents: 'read' })
  })
})

describe('the jobs that hold the preview key', () => {
  it.each(KEY_JOBS)('%s names the `preview` environment, and no job names `production`', (id) => {
    expect(String(jobs[id].environment).toLowerCase()).toBe(ENVIRONMENT)
    for (const job of Object.values(jobs))
      expect(JSON.stringify(job.environment ?? '').toLowerCase()).not.toContain('production')
    expect(codeOf('preview.yml')).not.toMatch(/environment:\s*['"]?production/i)
  })

  it.each(KEY_JOBS)('%s checks out main’s scripts, never the pull request’s code', (id) => {
    expect(checkouts(id).length).toBeGreaterThan(0)
    for (const c of checkouts(id)) {
      expect(c.with.ref).toBe('${{ github.event.pull_request.base.sha }}')
      expect(c.with['persist-credentials']).toBe(false)
    }
    // The commit's name (hex) is passed to the deploy script; a branch name or the merge ref never is
    expect(JSON.stringify(jobs[id])).not.toMatch(/head_ref|head\.ref|merge_commit|pull\/\$/)
  })

  it.each(KEY_JOBS)(
    '%s runs only the preview scripts and builds, installs or unpacks nothing',
    (id) => {
      const runs = steps(id).map((s) => s.run ?? '')
      for (const run of runs) {
        expect(run).not.toMatch(/\b(npm|npx|node|yarn|pnpm|tar|unzip|make|pip)\b/)
        expect(run).not.toMatch(/build-release|deploy-release/)
      }
      const scripts = runs.flatMap((r) =>
        [...r.matchAll(/bash (\.github\/scripts\/\S+)/g)].map((m) => m[1]),
      )
      for (const script of scripts) {
        expect(script).toMatch(/^\.github\/scripts\/preview-(facts|deploy)\.sh$/)
        expect(fs.existsSync(path.join(ROOT, script))).toBe(true)
      }
    },
  )

  it('call no other workflow and pass no secrets on', () => {
    for (const job of Object.values(jobs)) {
      expect(job.uses).toBeUndefined()
      expect(job.secrets).toBeUndefined()
    }
  })

  it('read only the environment’s own secrets, each listed in ops/previews.md', () => {
    const used = new Set(KEY_JOBS.flatMap((id) => secretsRead(jobs[id])))
    expect([...used].sort()).toEqual([...SECRET_NAMES].sort())
    const doc = fs.readFileSync(path.join(ROOT, 'ops', 'previews.md'), 'utf8')
    for (const name of SECRET_NAMES) expect(doc).toContain(name)
  })

  it('ask the server only through the vps-ssh action, with the preview key and no other credential', () => {
    for (const id of KEY_JOBS) {
      const ssh = steps(id).find((s) => s.uses === './.github/actions/vps-ssh')
      expect(ssh, id).toBeDefined()
      expect(JSON.stringify(ssh.with)).not.toMatch(/VPS_/)
    }
    expect(codeOf('preview.yml')).not.toMatch(/secrets\.VPS_|UMAMI_ADMIN_PASSWORD/)
  })
})

describe('the jobs that run unreviewed code, or write to the pull request', () => {
  it.each(OTHER_JOBS)('%s names no environment and reads no secret', (id) => {
    expect(jobs[id].environment).toBeUndefined()
    expect(secretsRead(jobs[id])).toEqual([])
  })

  it.each([...KEY_JOBS, ...OTHER_JOBS])('%s keeps no credential in the checkout', (id) => {
    for (const c of checkouts(id)) expect(c.with['persist-credentials']).toBe(false)
  })

  it('build checks out the pull request’s head, runs its install scripts, and has no secret-bearing step', () => {
    expect(checkouts('build')[0].with.ref).toBe('${{ github.event.pull_request.head.sha }}')
    expect(JSON.stringify(jobs.build)).not.toMatch(/secrets\./)
    expect(jobs.build.environment).toBeUndefined()
  })

  it('build uses the preview’s own address, folder and Turnstile test key, from ops/environment.sh', () => {
    const run = steps('build').find((s) => s.name === 'Build').run
    expect(run).toContain('. ops/environment.sh')
    expect(run).toContain('NEXT_PUBLIC_SERVER_URL="$SITE_URL"')
    expect(run).toContain('NEXT_PUBLIC_TURNSTILE_SITE_KEY="$PREVIEW_TURNSTILE_SITE_KEY"')
    expect(run).toContain('RELEASE_DIR="$APP_DIR/releases/$SHA"')
    expect(run).toContain('bash ops/build-release.sh')
  })

  it('report may write pull request comments and nothing else', () => {
    expect(jobs.report.permissions).toEqual({ contents: 'read', 'pull-requests': 'write' })
    for (const id of ['gate', 'facts', 'build', 'deploy'])
      expect(jobs[id].permissions).toBeUndefined()
    expect(checkouts('report')[0].with.ref).toBe('${{ github.event.pull_request.base.sha }}')
  })

  it('the gate runs on every event, and the rest wait for it', () => {
    for (const id of ['facts', 'build', 'deploy', 'report'])
      expect(jobs[id].needs).toContain('gate')
    expect(jobs.facts.if).toContain("needs.gate.outputs.build == 'true'")
  })
})

describe('what the preview workflow never touches', () => {
  it('is not a required check of the production deploy, and the deploy and CI don’t mention it', () => {
    const required = fs.readFileSync(path.join(ROOT, '.github/scripts/require-checks.sh'), 'utf8')
    for (const job of Object.values(jobs)) expect(required).not.toContain(job.name)
    for (const name of ['deploy.yml', 'ci.yml'])
      expect(read(name)).not.toMatch(/preview\.yml|pull-request-preview/)
  })

  it('keeps the production deploy’s secrets out of reach (the other workflow test covers the rest)', () => {
    expect(codeOf('preview.yml')).not.toMatch(/VPS_(HOST|USER|PORT|SSH_KEY|KNOWN_HOSTS)/)
  })
})
