// The security shape of the preview sign-in workflow (#1394): it runs on dispatch only, holds the preview key
// like the deploy does, runs main's script, and gives the passwords no way into a public place (no artifact,
// no comment, no step output). The server and the environment are the boundary against a dishonest dispatch
// (ops/previews.md); these checks keep an honest change from widening it.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import yaml from 'js-yaml'
import { describe, expect, it } from 'vitest'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const FILE = '.github/workflows/preview-sign-in.yml'
const raw = fs.readFileSync(path.join(ROOT, FILE), 'utf8')
const code = raw
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('#'))
  .join('\n')
const workflow = yaml.load(raw)
const job = workflow.jobs.seal
const steps = job.steps

describe('the preview sign-in workflow', () => {
  it('runs on dispatch only: never on a pull request, a push, a schedule or another workflow', () => {
    expect(Object.keys(workflow.on)).toEqual(['workflow_dispatch'])
    expect(code).not.toMatch(/pull_request|workflow_run|workflow_call|schedule|push:/)
  })

  it('asks for the number and the public key, both required', () => {
    const { inputs } = workflow.on.workflow_dispatch
    expect(Object.keys(inputs)).toEqual(['number', 'public_key_base64'])
    for (const input of Object.values(inputs)) expect(input.required).toBe(true)
  })

  it('has one job, in the `preview` environment, never `production`', () => {
    expect(Object.keys(workflow.jobs)).toEqual(['seal'])
    expect(job.environment).toBe('preview')
    expect(code).not.toMatch(/production/i)
    expect(job.uses).toBeUndefined()
    expect(job.secrets).toBeUndefined()
  })

  it('has a read-only token and no write permission anywhere', () => {
    expect(workflow.permissions).toEqual({ contents: 'read' })
    expect(job.permissions).toBeUndefined()
  })

  it('checks out the default branch’s scripts, never the branch it was started from', () => {
    const checkouts = steps.filter((s) => String(s.uses ?? '').startsWith('actions/checkout@'))
    expect(checkouts).toHaveLength(1)
    expect(checkouts[0].with.ref).toBe('${{ github.event.repository.default_branch }}')
    expect(checkouts[0].with['persist-credentials']).toBe(false)
  })

  it('reaches the server only through the vps-ssh action, with the preview key', () => {
    const ssh = steps.find((s) => s.uses === './.github/actions/vps-ssh')
    expect(ssh).toBeDefined()
    expect(JSON.stringify(ssh.with)).not.toMatch(/VPS_/)
    expect(code).not.toMatch(/secrets\.VPS_|UMAMI_ADMIN_PASSWORD/)
  })

  it('runs only the sealing script, with the inputs as environment variables and never in the command text', () => {
    const runs = steps.filter((s) => s.run)
    expect(runs.map((s) => s.run.trim())).toEqual(['bash .github/scripts/preview-credentials.sh'])
    for (const s of runs) expect(s.run).not.toContain('${{')
    expect(runs[0].env).toEqual({
      NUMBER: '${{ inputs.number }}',
      PUBLIC_KEY_B64: '${{ inputs.public_key_base64 }}',
    })
    expect(fs.existsSync(path.join(ROOT, '.github/scripts/preview-credentials.sh'))).toBe(true)
  })

  it('gives the sign-in no way out but the sealed log line: no artifact, comment, output or summary', () => {
    expect(code).not.toMatch(
      /upload-artifact|actions\/cache|GITHUB_OUTPUT|GITHUB_STEP_SUMMARY|GITHUB_ENV/,
    )
    expect(code).not.toMatch(/gh (pr|issue|api)|github-script|pull-requests|issues:/)
    expect(job.outputs).toBeUndefined()
  })

  it('never turns tracing on, which would print the plaintext', () => {
    expect(code).not.toMatch(/set -[a-z]*x|xtrace|ACTIONS_STEP_DEBUG|ACTIONS_RUNNER_DEBUG/)
  })

  it('queues one run at a time and never cancels one halfway', () => {
    expect(workflow.concurrency['cancel-in-progress']).toBe(false)
  })
})
