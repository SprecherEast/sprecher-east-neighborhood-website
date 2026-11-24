/**
 * The loader of the endpoints, AI agent tools and jobs pages (#1461), run on this repository:
 * what it joins from the loaded config, the route files and the source. The pure parts have their
 * own tests; this one checks the joins, which only real data can show. It takes about 20 seconds.
 */
import path from 'node:path'
import ts from 'typescript'
import { beforeAll, describe, expect, it } from 'vitest'

import { loadFacts } from './loadFacts.mjs'

const root = path.resolve(import.meta.dirname, '../..')
let facts

beforeAll(async () => {
  const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile)
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root)
  const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options })
  facts = await loadFacts({ root, program })
}, 180_000)

const model = (slug) => facts.models.find((entry) => entry.slug === slug)

describe('loadFacts on this repository', () => {
  it('gives each content type its REST setting, tools and jobs', () => {
    expect(facts.models.filter((entry) => !entry.rest).map((entry) => entry.slug)).toEqual([
      'payload-migrations',
    ])
    expect(model('email-confirmations').jobs).toEqual(['deleteExpiredEmailConfirmations'])
    expect(model('events').jobs).toEqual([])
    expect(model('events').tools).toContain('submitSuggestion')
    expect(model('pages').tools).toEqual([])
  })

  it('finds the routes each job access guards, from the payload-jobs type', () => {
    const run = facts.scheduled.jobs.access.find((entry) => entry.operation === 'run')
    expect(run.endpoints).toEqual([
      'GET /api/payload-jobs/run',
      'GET /api/payload-jobs/handle-schedules',
    ])
  })

  it('reads the workflows and the server scripts by their file type', () => {
    const workflows = facts.scheduled.workflows.map((entry) => entry.file)
    expect(workflows).toContain('.github/workflows/lint.yml')
    expect(workflows.every((file) => /\.ya?ml$/.test(file))).toBe(true)
    expect(facts.scheduled.extras.serverCrons.map((entry) => entry.file)).toEqual([
      'ops/install-cron.sh',
    ])
  })

  it('keeps the GraphQL settings that are set, and tells route handlers from admin pages', () => {
    expect(facts.api.graphQL.settings.map(([key]) => key)).toEqual([
      'disableIntrospectionInProduction',
      'disablePlaygroundInProduction',
      'maxComplexity',
    ])
    expect(facts.api.adminPages.map((page) => page.url)).toEqual(['/admin/[[...segments]]'])
    const urls = facts.api.routeHandlers.map((handler) => handler.url)
    expect(urls).toContain('/api/version')
    expect(urls).toContain('/api/[...slug]')
    expect(urls).not.toContain('/admin/[[...segments]]')
    expect(facts.api.routeHandlers.every((handler) => handler.methods.length > 0)).toBe(true)
  })
})
