// The deploy's off-site backup step (#1332): the Drive credential is a secret of the `production` environment and
// goes to the server over the SSH session's stdin, as the Umami admin password does (#948). It must never sit in a
// command line, an argument or a file of the workflow, where the (public) run log could show it.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import yaml from 'js-yaml'
import { describe, expect, it } from 'vitest'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const deploy = yaml.load(fs.readFileSync(path.join(ROOT, '.github/workflows/deploy.yml'), 'utf8'))
const step = deploy.jobs.deploy.steps.find((s) => String(s.name ?? '').includes('off-site backup'))

describe('the deploy step for the off-site backup', () => {
  it('exists in the deploy job, which names the production environment', () => {
    expect(step).toBeDefined()
    expect(String(deploy.jobs.deploy.environment).toLowerCase()).toBe('production')
  })

  it('reads the credential from the environment and pipes it to the installer over stdin', () => {
    expect(step.env.OFFSITE_BACKUP_RCLONE_CONF).toBe('${{ secrets.OFFSITE_BACKUP_RCLONE_CONF }}')
    expect(step.run).not.toContain('secrets.')
    expect(step.run).toMatch(
      /printf '%s' "\$OFFSITE_BACKUP_RCLONE_CONF" \| ssh vps "bash [^"]*install-offsite-backup\.sh --config-stdin"/,
    )
    // never as an argument or a command of its own
    expect(step.run.replace(/printf '%s' "\$OFFSITE_BACKUP_RCLONE_CONF" \|/, '')).not.toContain(
      'OFFSITE_BACKUP_RCLONE_CONF',
    )
    expect(step.run).not.toMatch(/\bset -x\b|\becho\b.*OFFSITE/)
  })

  it("has its own time limit, shorter than the job's, so a hung call cannot cancel the checks after it", () => {
    expect(step['timeout-minutes']).toBeGreaterThan(0)
    expect(step['timeout-minutes']).toBeLessThan(deploy.jobs.deploy['timeout-minutes'])
  })

  it('runs only when the deploy was not skipped, after the release is live', () => {
    const names = deploy.jobs.deploy.steps.map((s) => s.name ?? '')
    expect(names.indexOf(step.name)).toBeGreaterThan(
      names.findIndex((n) => n.startsWith('Put the release live')),
    )
    expect(step.if).toContain("steps.order.outputs.skip != 'true'")
  })
})

describe('the public certificate', () => {
  it('can be committed: .gitignore skips *.pem, so it names this file as an exception', () => {
    // exit 1 means "not ignored"; 0 would mean `git add` silently skips the owner's certificate
    const result = spawnSync('git', ['check-ignore', '-q', 'ops/offsite-backup-cert.pem'], {
      cwd: ROOT,
    })
    expect(result.status).toBe(1)
  })

  it('is the one *.pem that is allowed: another .pem in ops stays ignored', () => {
    const result = spawnSync('git', ['check-ignore', '-q', 'ops/private-key.pem'], { cwd: ROOT })
    expect(result.status).toBe(0)
  })
})
