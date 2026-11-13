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

/** Every secret a job reads (`secrets.NAME`, `secrets['NAME']`, `toJSON(secrets)`), except the token GitHub gives each run for free. */
function secretsRead(job) {
  // A calling job's `secrets: inherit` passes secrets on without naming one; a `secrets:` mapping names them, so it still counts.
  const { secrets: passed, ...body } = job
  if (passed !== undefined && passed !== 'inherit') body.passed = passed
  const found = JSON.stringify(body).matchAll(
    /secrets(?:\.([A-Za-z0-9_]+)|\[\\?['"]([A-Za-z0-9_]+)\\?['"]\]|(?![A-Za-z0-9_.]))/g,
  )
  return [...new Set([...found].map((m) => m[1] ?? m[2] ?? '*'))].filter(
    (n) => n !== 'GITHUB_TOKEN',
  )
}

/** The environment a job names, whether written `environment: production` or with a `name:` key.
 * GitHub treats environment names as case-insensitive, so the name is lower-cased. */
function environmentOf(job) {
  const env = job.environment
  const name = typeof env === 'object' && env !== null ? env.name : env
  return name === undefined ? undefined : String(name).toLowerCase()
}

// The deploy secrets are whatever deploy.yml reads, so the workflow and this test can't drift apart.
const DEPLOY_SECRETS = [...new Set(Object.values(load('deploy.yml').jobs).flatMap(secretsRead))]
  .filter((n) => n !== '*')
  .map((n) => n.toUpperCase())

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
        expect(environmentOf(jobs[id]), `${id} reads ${reads.join(', ')}`).toBe(ENVIRONMENT)
      } else {
        expect(environmentOf(jobs[id]), `${id} reads no secret`).toBeUndefined()
      }
    },
  )

  it('the build job, which runs npm install scripts, reads no secret and names no environment', () => {
    expect(secretsRead(jobs.build)).toEqual([])
    expect(environmentOf(jobs.build)).toBeUndefined()
  })

  it('no workflow but the deploy names the environment, in either form', () => {
    // Only the reusable deploy is allowed to name it, and CI calls that on pushes to main alone.
    for (const name of fs.readdirSync(WORKFLOWS).filter((f) => /\.ya?ml$/.test(f))) {
      if (name === 'deploy.yml') continue
      for (const [id, job] of Object.entries(load(name).jobs ?? {})) {
        expect(environmentOf(job), `${name} job ${id} must not use ${ENVIRONMENT}`).not.toBe(
          ENVIRONMENT,
        )
        expect(
          String(environmentOf(job) ?? ''),
          `${name} job ${id} names an expression`,
        ).not.toContain('${{')
        expect(
          secretsRead(job).filter((n) => n === '*' || DEPLOY_SECRETS.includes(n.toUpperCase())),
          `${name} job ${id} reads a deploy secret`,
        ).toEqual([])
      }
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
