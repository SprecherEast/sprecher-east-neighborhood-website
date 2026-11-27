// How the production deploy builds the developer site (#1459, #1530): the developer pages and the Storybook
// showcase, inside the release build, which has no secret, with a failed build a warning that leaves the
// release without it. The publishing
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
  it('builds the developer pages and the showcase into the release, as folders the server script publishes from', () => {
    expect(buildStep.env.DEVELOPER_PAGES_DEST).toBe('developer-site/pages')
    expect(buildStep.env.SHOWCASE_DEST).toBe('developer-site/storybook')
    expect(buildStep.run).toBe('bash ops/build-release.sh')
  })

  it('lets a failed build leave the release without it, never fail the build', () => {
    expect(buildStep.env.DEVELOPER_PAGES_OPTIONAL).toBe('yes')
    expect(buildStep.env.SHOWCASE_OPTIONAL).toBe('yes')
  })

  it('adds no job of its own: the jobs are the same three, so none can fail the run for the developer site', () => {
    expect(Object.keys(jobs)).toEqual(['preflight', 'build', 'deploy'])
  })

  it('keeps the build job free of environments and secrets, with the developer pages and the showcase built in it', () => {
    expect(jobs.build.environment).toBeUndefined()
    expect(JSON.stringify(jobs.build)).not.toMatch(/secrets\./)
  })

  it('names the folders where ops/developer-site.sh looks for them', () => {
    const script = fs.readFileSync(path.join(ROOT, 'ops/developer-site.sh'), 'utf8')
    expect(script).toContain(`PAGES_SOURCE="$CODE_DIR/${buildStep.env.DEVELOPER_PAGES_DEST}"`)
    expect(script).toContain(`STORYBOOK_SOURCE="$CODE_DIR/${buildStep.env.SHOWCASE_DEST}"`)
  })
})
