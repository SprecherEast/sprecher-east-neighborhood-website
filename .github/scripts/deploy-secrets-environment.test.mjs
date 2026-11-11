// The production deploy secrets are secrets of the `production` environment, which only runs from
// `main` (#1071). A job that reads one of them must name that environment, or the secret would
// have to stay readable from every branch. The build job runs npm's install scripts, so it names
// no environment and reads no secret.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import yaml from 'js-yaml'
import { describe, expect, it } from 'vitest'

const WORKFLOWS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'workflows')
const ENVIRONMENT = 'production'

function load(name) {
  return yaml.load(fs.readFileSync(path.join(WORKFLOWS, name), 'utf8'))
}

/** Every `secrets.NAME` a job reads, except the token GitHub gives each run for free. */
function secretsRead(job) {
  const names = JSON.stringify(job).match(/secrets\.[A-Za-z0-9_]+/g) ?? []
  return [...new Set(names.map((n) => n.slice('secrets.'.length)))].filter(
    (n) => n !== 'GITHUB_TOKEN',
  )
}

describe('deploy workflow and the production environment', () => {
  const { jobs } = load('deploy.yml')

  it('has jobs that read secrets, so this test checks something', () => {
    expect(secretsRead(jobs.preflight).length).toBeGreaterThan(0)
    expect(secretsRead(jobs.deploy).length).toBeGreaterThan(0)
  })

  it.each(Object.keys(jobs))(
    'job "%s" names the environment exactly when it reads a secret',
    (id) => {
      const reads = secretsRead(jobs[id])
      if (reads.length > 0) {
        expect(jobs[id].environment, `${id} reads ${reads.join(', ')}`).toBe(ENVIRONMENT)
      } else {
        expect(jobs[id].environment, `${id} reads no secret`).toBeUndefined()
      }
    },
  )

  it('the build job, which runs npm install scripts, reads no secret and names no environment', () => {
    expect(secretsRead(jobs.build)).toEqual([])
    expect(jobs.build.environment).toBeUndefined()
  })

  it('every job that runs for a pull request of this repository stays out of the environment', () => {
    // Only the reusable deploy is allowed to name it, and CI calls that on pushes to main alone.
    for (const name of fs.readdirSync(WORKFLOWS).filter((f) => /\.ya?ml$/.test(f))) {
      if (name === 'deploy.yml') continue
      const text = fs.readFileSync(path.join(WORKFLOWS, name), 'utf8')
      expect(text, `${name} must not use the ${ENVIRONMENT} environment`).not.toMatch(
        new RegExp(`environment:\\s*['"]?${ENVIRONMENT}\\b`),
      )
    }
  })

  it('CI calls the deploy only for a push to main', () => {
    const ci = load('ci.yml')
    const caller = Object.values(ci.jobs).find(
      (job) => job.uses === './.github/workflows/deploy.yml',
    )
    expect(caller).toBeDefined()
    expect(caller.if).toContain("github.event_name == 'push'")
    expect(caller.if).toContain("github.ref == 'refs/heads/main'")
  })
})
