// How the production deploy builds the developer site's showcase (#1459): inside the release build, which
// has no secret, with a failed showcase build a warning that leaves the release without one. The publishing
// is ops/deploy-release.sh's housekeeping (ops/developer-site.test.mjs), so the workflow gains no job, no
// secret and no SSH step: a problem with the developer site can never be a failed job of the deploy.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import yaml from 'js-yaml'
import { describe, expect, it } from 'vitest'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const deploy = yaml.load(fs.readFileSync(path.join(ROOT, '.github/workflows/deploy.yml'), 'utf8'))
const { jobs } = deploy
const buildStep = jobs.build.steps.find((step) => step.name === 'Build')

describe('deploy.yml and the developer site', () => {
  it('builds the showcase into the release, as a folder the server script publishes from', () => {
    expect(buildStep.env.SHOWCASE_DEST).toBe('developer-site/showcase')
    expect(buildStep.run).toBe('bash ops/build-release.sh')
  })

  it('lets a failed showcase build leave the release without one, never fail the build', () => {
    expect(buildStep.env.SHOWCASE_OPTIONAL).toBe('yes')
  })

  it('adds no job of its own: the jobs are the same three, so none can fail the run for the developer site', () => {
    expect(Object.keys(jobs)).toEqual(['preflight', 'build', 'deploy'])
  })

  it('keeps the build job free of environments and secrets, with the showcase built in it', () => {
    expect(jobs.build.environment).toBeUndefined()
    expect(JSON.stringify(jobs.build)).not.toMatch(/secrets\./)
  })

  it('names the folder where ops/developer-site.sh looks for it', () => {
    const script = fs.readFileSync(path.join(ROOT, 'ops/developer-site.sh'), 'utf8')
    expect(script).toContain(`SHOWCASE_SOURCE="$CODE_DIR/${buildStep.env.SHOWCASE_DEST}"`)
  })
})
