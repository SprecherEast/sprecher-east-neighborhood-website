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
const KEY_JOBS = ['facts', 'deploy', 'teardown'] // the jobs that hold the preview key
const OTHER_JOBS = ['gate', 'build', 'report', 'removed']
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

  it('reacts to a push, to the label being added and to the pull request closing, and to nothing else', () => {
    expect(workflow.on.pull_request.types).toEqual([
      'opened',
      'synchronize',
      'reopened',
      'labeled',
      'closed',
    ])
  })

  it('has no workflow-level cancellation, which would cancel a deploy in the middle of its ssh session', () => {
    expect(workflow.concurrency).toBeUndefined()
  })

  it.each(['gate', 'build'])(
    '%s is replaced by a newer push, and a label other than `preview` never cancels it',
    (id) => {
      const c = jobs[id].concurrency
      expect(c['cancel-in-progress']).toBe(true)
      expect(c.group).toContain('github.event.pull_request.number')
      expect(c.group).toContain('github.run_id') // the unique group of another label
    },
  )

  it('deploy has one group per pull request and is never cancelled: a newer deploy waits its turn', () => {
    const c = jobs.deploy.concurrency
    expect(c['cancel-in-progress']).toBe(false)
    expect(c.group).toContain('github.event.pull_request.number')
    expect(c.group).not.toContain('github.run_id')
    // distinct from the groups that cancel, or a newer build would cancel this deploy
    const name = (group) => group.split('${{')[0] // the fixed part, before the pull request's number
    expect(name(c.group)).not.toBe(name(jobs.build.concurrency.group))
    expect(name(c.group)).not.toBe(name(jobs.gate.concurrency.group))
    expect(jobs.facts.concurrency).toBeUndefined()
  })

  it('report is one at a time per pull request, never cancelled, and skipped for a superseded run', () => {
    expect(jobs.report.concurrency['cancel-in-progress']).toBe(false)
    expect(jobs.report.concurrency.group).toContain('github.event.pull_request.number')
    expect(jobs.report.if).toContain("needs.build.result != 'cancelled'")
    expect(jobs.report.if).toContain("needs.deploy.result != 'cancelled'")
  })

  it('skips the gate for a label other than `preview`, and for a closed pull request', () => {
    expect(jobs.gate.if).toContain("github.event.label.name == 'preview'")
    expect(jobs.gate.if).toContain("github.event.action != 'closed'")
  })

  it('has a read-only token by default', () => {
    expect(workflow.permissions).toEqual({ contents: 'read' })
  })
})

describe('teardown when the pull request closes (#1076)', () => {
  it('runs only on a closed pull request of this repository that is not Dependabot’s', () => {
    const condition = jobs.teardown.if.replace(/\s+/g, ' ')
    expect(condition).toContain("github.event.action == 'closed'")
    expect(condition).toContain(
      'github.event.pull_request.head.repo.full_name == github.repository',
    )
    expect(condition).toContain("!= 'dependabot[bot]'")
  })

  it('waits for, or replaces, a deploy of the same pull request: the same group, never cancelling one', () => {
    const c = jobs.teardown.concurrency
    expect(c.group).toBe(jobs.deploy.concurrency.group)
    expect(c['cancel-in-progress']).toBe(false)
  })

  it('names only the `preview` environment and runs the wrapper’s teardown through the script', () => {
    expect(jobs.teardown.environment).toBe(ENVIRONMENT)
    const run = steps('teardown').find((s) => s.id === 'teardown').run
    expect(run).toBe('bash .github/scripts/preview-teardown.sh')
    expect(steps('teardown').find((s) => s.id === 'teardown').env).toEqual({
      NUMBER: '${{ github.event.pull_request.number }}',
    })
  })

  it('edits only a comment the preview already has, with a write token that does nothing else', () => {
    expect(jobs.removed.needs).toBe('teardown')
    expect(jobs.removed.if).toContain("needs.teardown.outputs.removed == 'yes'")
    expect(jobs.removed.permissions).toEqual({ contents: 'read', 'pull-requests': 'write' })
    expect(JSON.stringify(jobs.removed)).toContain('if (!existing) return')
  })

  it('the other jobs do not run for a closed pull request: the gate skips, and they wait for it', () => {
    for (const id of ['facts', 'build', 'deploy', 'report'])
      expect(jobs[id].needs).toContain('gate')
    expect(jobs.report.if).toContain("needs.gate.outputs.build == 'true'")
  })
})

describe('the nightly sweep', () => {
  const sweep = yaml.load(read('preview-sweep.yml'))
  const job = sweep.jobs.sweep

  it('runs on a schedule and by hand, and on a pull request never', () => {
    expect(Object.keys(sweep.on).sort()).toEqual(['schedule', 'workflow_dispatch'])
    expect(sweep.on.schedule).toHaveLength(1)
    expect(codeOf('preview-sweep.yml')).not.toMatch(/pull_request|workflow_run|workflow_call/)
  })

  it('names only the `preview` environment, reads its secrets only, and calls no other workflow', () => {
    expect(job.environment).toBe(ENVIRONMENT)
    expect(Object.keys(sweep.jobs)).toEqual(['sweep'])
    expect([...new Set(secretsRead(job))].sort()).toEqual([...SECRET_NAMES].sort())
    expect(codeOf('preview-sweep.yml')).not.toMatch(/environment:\s*['"]?production|VPS_/i)
    expect(job.uses).toBeUndefined()
  })

  it('checks out the default branch’s scripts and runs the sweep script only', () => {
    const checkout = job.steps.find((s) => String(s.uses ?? '').startsWith('actions/checkout@'))
    expect(checkout.with.ref).toBe('${{ github.event.repository.default_branch }}')
    expect(checkout.with['persist-credentials']).toBe(false)
    const runs = job.steps.map((s) => s.run).filter((run) => run?.startsWith('bash '))
    expect(runs).toEqual(['bash .github/scripts/preview-sweep.sh'])
  })

  it.each([
    ['the sweep', () => job.steps],
    ['the teardown', () => steps('teardown')],
  ])('%s does nothing, and does not fail, while the environment holds no key', (_name, get) => {
    const all = get()
    const check = all.find((s) => s.id === 'values')
    expect(check.env).toEqual({ KEY: '${{ secrets.PREVIEW_SSH_KEY }}' })
    for (const step of all.filter(
      (s) => s.uses === './.github/actions/vps-ssh' || s.run?.startsWith('bash '),
    ))
      expect(step.if).toBe("steps.values.outputs.set == 'true'")
  })

  it('can read pull requests and write nothing', () => {
    expect(sweep.permissions).toEqual({ contents: 'read' })
    expect(job.permissions).toEqual({ contents: 'read', 'pull-requests': 'read' })
  })

  it('is one at a time and never cancelled in the middle of its ssh calls', () => {
    expect(sweep.concurrency['cancel-in-progress']).toBe(false)
  })

  it('is not a required check', () => {
    const required = fs.readFileSync(path.join(ROOT, '.github/scripts/require-checks.sh'), 'utf8')
    expect(required).not.toContain(job.name)
  })
})

describe('the jobs that hold the preview key', () => {
  it.each(KEY_JOBS)('%s names the `preview` environment, and no job names `production`', (id) => {
    expect(String(jobs[id].environment).toLowerCase()).toBe(ENVIRONMENT)
    for (const job of Object.values(jobs))
      expect(JSON.stringify(job.environment ?? '').toLowerCase()).not.toContain('production')
    expect(codeOf('preview.yml')).not.toMatch(/environment:\s*['"]?production/i)
  })

  it.each(KEY_JOBS)(
    '%s checks out the default branch’s scripts, never the pull request’s code or its base’s (a stacked pull request’s base is another branch)',
    (id) => {
      expect(checkouts(id).length).toBeGreaterThan(0)
      for (const c of checkouts(id)) {
        expect(c.with.ref).toBe('${{ github.event.repository.default_branch }}')
        expect(c.with['persist-credentials']).toBe(false)
      }
      // The commit's name (hex) is passed to the deploy script; a branch name or the merge ref never is
      expect(JSON.stringify(jobs[id])).not.toMatch(
        /head_ref|head\.ref|merge_commit|base\.sha|base\.ref|pull\/\$/,
      )
    },
  )

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
        expect(script).toMatch(/^\.github\/scripts\/preview-(facts|deploy|teardown)\.sh$/)
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
    expect(checkouts('report')[0].with.ref).toBe('${{ github.event.repository.default_branch }}')
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
