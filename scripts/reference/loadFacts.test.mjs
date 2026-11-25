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
import { findCollectionCalls } from './collectionCalls.mjs'
import { loadFacts } from './loadFacts.mjs'
import { collectAppFiles, publicEntries } from './metadataRoutes.mjs'
import { findServerActions } from './sourceFacts.mjs'
import { parseDependabot, parseIntelligenceSchedule } from './timers.mjs'

const root = path.resolve(import.meta.dirname, '../..')
let facts
let config
let mcpOptions
let program

beforeAll(async () => {
  for (const [key, value] of Object.entries(GENERATOR_ENV)) vi.stubEnv(key, value)
  const harness = await import('../../src/platform/payload/testing/accessHarness.ts')
  config = await harness.loadConfig()
  ;({ mcpOptions } = await import('../../src/modules/agents/cms.ts'))
  const tsconfig = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile)
  const parsed = ts.parseJsonConfigFileContent(tsconfig.config, ts.sys, root)
  program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options })
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
    // the server scripts come from `ops/`, and there is at least one timer of each kind
    expect(facts.scheduled.extras.serverCrons.length).toBeGreaterThan(0)
    for (const entry of facts.scheduled.extras.serverCrons) expect(entry.file).toMatch(/^ops\//)
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

  it('hands each reader the file or folder it is for: the timers, the source files and the public entries', () => {
    const read = (file) => ({ file, text: fs.readFileSync(path.join(root, file), 'utf8') })
    expect(facts.scheduled.extras.intelligence).toEqual(
      parseIntelligenceSchedule(read('intelligence/pipeline.yaml')),
    )
    expect(facts.scheduled.extras.dependabot).toEqual(
      parseDependabot(read('.github/dependabot.yml')),
    )
    expect(facts.api.appFiles).toEqual(collectAppFiles(root))
    expect(facts.api.publicFiles).toEqual(publicEntries(root))
    expect(facts.api.serverActions).toEqual(findServerActions(program, root))
    expect(facts.api.mcp.auth.name).toBe(mcpOptions.overrideAuth.name)
  })

  it('finds the files of access functions, hooks and GraphQL rules, which need the locator and the root', () => {
    const files = facts.models.flatMap((m) => [...m.access, ...m.hooks].map((entry) => entry.file))
    expect(files.some((file) => file.startsWith('src/'))).toBe(true)
    expect(facts.api.graphQL.rules.length).toBeGreaterThan(0)
    for (const rule of facts.api.graphQL.rules) expect(rule.file).toMatch(/^src\//)
    expect(facts.api.adminPages.length).toBeGreaterThan(0)
    for (const page of facts.api.adminPages)
      expect(fs.existsSync(path.join(root, page.file))).toBe(true)
    // no absolute path of this machine anywhere, in a setting or a file
    expect(JSON.stringify(facts)).not.toContain(root)
    expect(facts.mcp.collectionTools.some((tool) => tool.access)).toBe(true)
    expect(facts.mcp.collectionTools.every((tool) => tool.access?.file)).toBe(true)
  })

  it('reads each custom tool’s input from its own schema and its custom checks, and the collections of its code', () => {
    const slugs = new Set(facts.models.map((m) => m.slug))
    const tools = facts.mcp.customTools
    expect(tools.length).toBe(mcpOptions.mcp.tools.length)
    for (const [index, tool] of mcpOptions.mcp.tools.entries()) {
      const shown = tools[index]
      expect(shown.file, tool.name).toMatch(/^src\//)
      expect(shown.input.map((row) => row.name)).toEqual(Object.keys(tool.parameters))
      const messages = Object.values(tool.parameters).flatMap((schema) =>
        (schema._zod.def.checks ?? [])
          .concat(schema._zod.def.innerType?._zod.def.checks ?? [])
          .filter((rule) => rule._zod.def.check === 'custom')
          .map((rule) => rule._zod.def.error?.({})),
      )
      for (const message of messages) {
        expect(JSON.stringify(shown.input), message).toContain(message)
      }
      expect(shown.collections).toEqual(
        findCollectionCalls(program, root, shown.file, { name: tool.name, knownSlugs: slugs }),
      )
    }
  })

  it('finds the collections of each task’s handler and of each schedule hook, by file, task and name', () => {
    const slugs = new Set(facts.models.map((m) => m.slug))
    for (const task of facts.scheduled.jobs.tasks.filter((t) => t.file.startsWith('src/'))) {
      expect(task.collections, task.slug).toEqual(
        findCollectionCalls(program, root, task.file, {
          name: task.slug,
          configFile: 'src/payload.config.ts',
          knownSlugs: slugs,
        }),
      )
      for (const hook of task.schedules
        .flatMap((s) => s.hooks)
        .filter((h) => h.file.startsWith('src/'))) {
        expect(hook.collections, `${task.slug} ${hook.name}`).toEqual(
          findCollectionCalls(program, root, hook.file, {
            name: task.slug,
            hook: hook.name,
            configFile: 'src/payload.config.ts',
            knownSlugs: slugs,
          }),
        )
      }
    }
  })
})
