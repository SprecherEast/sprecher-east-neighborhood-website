/**
 * The loader of the endpoints, AI agent tools and jobs pages (#1461), run on this repository. It
 * checks the loader's joins against the loaded config and the files on disk, not against facts of
 * the product, so a correct change to the repository does not fail it. It takes about 20 seconds.
 */
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { GENERATOR_ENV } from '../content-types/environment.mjs'
import { loadFacts } from './loadFacts.mjs'

const root = path.resolve(import.meta.dirname, '../..')
let facts
let config

beforeAll(async () => {
  for (const [key, value] of Object.entries(GENERATOR_ENV)) vi.stubEnv(key, value)
  const harness = await import('../../src/platform/payload/testing/accessHarness.ts')
  config = await harness.loadConfig()
  const tsconfig = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile)
  const parsed = ts.parseJsonConfigFileContent(tsconfig.config, ts.sys, root)
  const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options })
  facts = await loadFacts({ root, program })
}, 180_000)

const typesOfConfig = () => [...config.collections, ...config.globals]

describe('loadFacts on this repository', () => {
  it('gives every content type of the config one entry, with REST off exactly where the config says', () => {
    expect(facts.models.map((m) => m.slug).sort()).toEqual(
      typesOfConfig()
        .map((t) => t.slug)
        .sort(),
    )
    const off = typesOfConfig()
      .filter((t) => t.endpoints === false)
      .map((t) => t.slug)
    expect(
      facts.models
        .filter((m) => !m.rest)
        .map((m) => m.slug)
        .sort(),
    ).toEqual(off.sort())
  })

  it('lists on each type the tasks that reach it, and gives some type a job and some a tool', () => {
    const tasks = facts.scheduled.jobs.tasks
    const reaches = (task, slug) =>
      [task.collections, ...task.schedules.flatMap((s) => s.hooks.map((h) => h.collections))].some(
        (list) => list.some((c) => c.collection === slug),
      )
    for (const model of facts.models) {
      const expected = tasks.filter((task) => reaches(task, model.slug)).map((task) => task.slug)
      expect(model.jobs, model.slug).toEqual(expected)
    }
    expect(facts.models.some((m) => m.jobs.length > 0)).toBe(true)
    expect(facts.models.some((m) => m.tools.length > 0)).toBe(true)
  })

  it('finds the routes each job access guards among the routes of the jobs collection', () => {
    const jobs = config.collections.find((c) => c.slug === 'payload-jobs')
    const found = facts.scheduled.jobs.access.flatMap((entry) => entry.endpoints)
    expect(found.length).toBeGreaterThan(0)
    for (const route of found) {
      const [method, url] = route.split(' ')
      const own = jobs.endpoints.find(
        (e) => String(e.method).toUpperCase() === method && url.endsWith(e.path),
      )
      expect(own, route).toBeDefined()
      expect(url.startsWith(`${config.routes.api}/payload-jobs`)).toBe(true)
    }
  })

  it('reads the workflows and the server scripts by their file type, from the folders', () => {
    const onDisk = (folder, extension) =>
      fs.readdirSync(path.join(root, folder)).filter((name) => extension.test(name))
    const workflows = facts.scheduled.workflows.map((entry) => path.basename(entry.file))
    for (const name of workflows) expect(onDisk('.github/workflows', /\.ya?ml$/)).toContain(name)
    for (const entry of facts.scheduled.extras.serverCrons) {
      expect(onDisk('ops', /\.sh$/)).toContain(path.basename(entry.file))
    }
    const scheduled = onDisk('.github/workflows', /\.ya?ml$/).filter((name) =>
      /^\s*schedule:/m.test(fs.readFileSync(path.join(root, '.github/workflows', name), 'utf8')),
    )
    expect(workflows.sort()).toEqual(scheduled.sort())
  })

  it('keeps the GraphQL settings the config sets, and tells route handlers from admin pages', () => {
    for (const [key, value] of facts.api.graphQL.settings) {
      expect(String(config.graphQL[key]), key).toBe(value)
    }
    expect(facts.api.graphQL.settings.length).toBeGreaterThan(0)
    expect(facts.api.adminPages.length).toBeGreaterThan(0)
    for (const page of facts.api.adminPages) expect(page.url.startsWith('/admin')).toBe(true)
    for (const handler of facts.api.routeHandlers) {
      expect(handler.url.startsWith('/admin'), handler.url).toBe(false)
      expect(handler.methods.length, handler.url).toBeGreaterThan(0)
    }
    expect(facts.api.routeHandlers.length).toBeGreaterThan(0)
  })

  it('tells collections from globals, finds the files of the routes, and what configures a plugin', () => {
    const kinds = Object.fromEntries(facts.models.map((m) => [m.slug, m.kind]))
    for (const type of config.collections) expect(kinds[type.slug]).toBe('collection')
    for (const type of config.globals) expect(kinds[type.slug]).toBe('global')
    for (const handler of facts.api.routeHandlers) {
      expect(fs.existsSync(path.join(root, handler.file)), handler.file).toBe(true)
    }
    // the loader reads the config file for the modules that configure a plugin
    expect(facts.models.some((m) => /configured with code from module/.test(m.owner.owner))).toBe(
      true,
    )
  })

  it('keeps exactly the GraphQL limits the config sets, under their own names', () => {
    const limits = [
      'disableIntrospectionInProduction',
      'disablePlaygroundInProduction',
      'maxComplexity',
    ]
    const set = limits.filter((key) => config.graphQL[key] !== undefined)
    expect(facts.api.graphQL.settings.map(([key]) => key)).toEqual(set)
  })
})
