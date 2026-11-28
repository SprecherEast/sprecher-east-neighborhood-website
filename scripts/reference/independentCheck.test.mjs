/**
 * An independent comparison (#1461): the generated pages that claim completeness are checked
 * against what the loaded config and the code say, found a different way from the generator.
 * Needs the pages to be built, which `npm test` does first (`npm run docs:generate`).
 *
 * - Endpoints: which routes of each content type Payload really reaches, using Payload's own
 *   matcher (`path-to-regexp`, as `handleEndpoints` does), compared with the "taken first" table.
 * - Jobs: every task, schedule and runner of `jobs`, and the route each access function guards,
 *   read from Payload's own handlers.
 * - Tools: every input field of the site's tools, with its limits read from the zod schema
 *   itself (not from the JSON schema the page is made from).
 */
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { GENERATOR_ENV } from '../content-types/environment.mjs'

const root = path.resolve(import.meta.dirname, '../..')
// Tables are padded to line up: compare with the padding collapsed
const page = (name) =>
  fs.readFileSync(path.join(root, 'docs/reference', name), 'utf8').replace(/ {2,}/g, ' ')
// Payload's own matcher, found from Payload's own package
const { match } = createRequire(createRequire(import.meta.url).resolve('payload'))('path-to-regexp')

let config
let mcpOptions
beforeAll(async () => {
  for (const [key, value] of Object.entries(GENERATOR_ENV)) vi.stubEnv(key, value)
  ;({ loadConfig: config } = await import('../../src/platform/payload/testing/accessHarness.ts'))
  config = await config()
  ;({ mcpOptions } = await import('../../src/modules/agents/cms.ts'))
}, 120_000)

/** The requests a pattern can get: each optional segment once present and once absent. */
const requests = (route) =>
  [route.path].flatMap(function expand(pattern) {
    const optional = pattern.match(/\/:[A-Za-z]+\?/)
    if (!optional) return [pattern.replace(/:[A-Za-z]+/g, 'x') || '/']
    return [
      ...expand(pattern.replace(optional[0], '')),
      ...expand(pattern.replace(optional[0], optional[0].slice(0, -1))),
    ]
  })

/** Payload's rule: the first endpoint of the same method whose pattern matches the request. */
const winner = (endpoints, method, request) =>
  endpoints.find(
    (e) => e.method === method && match(e.path, { decode: decodeURIComponent })(request),
  )

describe('endpoints.md against Payload’s own matching', () => {
  it('lists, for each content type, exactly the routes Payload never or only partly reaches', () => {
    const types = [...config.collections, ...config.globals]
    const expected = types.flatMap((type) =>
      (type.endpoints || []).flatMap((route) => {
        const taken = requests(route).filter(
          (request) => winner(type.endpoints, route.method, request) !== route,
        )
        const by = taken.map((request) => winner(type.endpoints, route.method, request).path)
        return taken.length === 0
          ? []
          : [
              `| ${route.method.toUpperCase()} | \`${route.path}\` | \`${type.slug}\` | \`${by[0]}\` |`,
            ]
      }),
    )
    expect(expected.length).toBeGreaterThan(0)
    const text = page('endpoints.md').replace(/\s+/g, ' ')
    const compact = (row) => row.replace(/\s+/g, ' ')
    const missing = expected.filter((row) => !text.includes(compact(row).replace(/ \|$/, '')))
    expect(missing).toEqual([])
    const listed = (
      text.match(
        /\| (GET|POST|PATCH|PUT|DELETE) \| `[^`]+` \| `[^`]+` \| `[^`]+` \| (every request|only a request to)/g,
      ) ?? []
    ).length
    expect(listed).toBe(expected.length)
  })
})

describe('jobs.md against the jobs config', () => {
  it('has every task, every schedule, every runner and the routes the run access guards', () => {
    const text = page('jobs.md')
    for (const task of config.jobs.tasks) {
      expect(text, task.slug).toContain(`| \`${task.slug}\` |`)
      for (const schedule of [task.schedule ?? []].flat()) {
        expect(text, `${task.slug} ${schedule.cron}`).toContain(`\`${schedule.cron}\``)
      }
    }
    for (const runner of config.jobs.autoRun) {
      expect(text, runner.cron).toContain(`| \`${runner.queue ?? 'default'}\` | \`${runner.cron}\``)
    }
    const jobs = config.collections.find((c) => c.slug === 'payload-jobs')
    const guarded = jobs.endpoints.filter((e) => /access\??\.run\b/.test(String(e.handler)))
    expect(guarded.length).toBeGreaterThan(0)
    for (const route of guarded) {
      expect(text, route.path).toContain(`GET ${config.routes.api}/payload-jobs${route.path}`)
    }
  })
})

describe('mcp-tools.md against the tools’ zod schemas', () => {
  it('lists every input field of every site tool with the limits the schema holds', () => {
    const text = page('mcp-tools.md')
    expect(mcpOptions.mcp.tools.length).toBeGreaterThan(0)
    // a backslash in a pattern is shown as it is, never doubled
    expect(text).not.toContain('\\\\')
    for (const tool of mcpOptions.mcp.tools) {
      const section = text.split(`### \`${tool.name}\``)[1].split('\n### ')[0]
      for (const [name, field] of Object.entries(tool.parameters)) {
        const row = section.split('\n').find((line) => line.startsWith(`| \`${name}\` |`))
        expect(row, `${tool.name}.${name}`).toBeDefined()
        let schema = field
        while (schema.unwrap) schema = schema.unwrap()
        // The limits are read from the schema's own checks (`def.checks`), not from JSON Schema
        for (const owner of [schema, schema.element].filter(Boolean)) {
          for (const check of owner._zod.def.checks ?? []) {
            const rule = check._zod.def
            if (rule.check === 'max_length')
              expect(row, `${name} max`).toContain(String(rule.maximum))
            if (rule.check === 'min_length' && rule.minimum > 1) {
              expect(row, `${name} min`).toContain(String(rule.minimum))
            }
            if (rule.check === 'greater_than')
              expect(row, `${name} min`).toContain(String(rule.value))
            // a rule written as a custom check is not in the JSON schema: the page says it, with its message
            if (rule.check === 'custom' && rule.error) {
              expect(row, `${name} custom check`).toContain(rule.error({}))
            }
            // a `.trim()` is no limit of the JSON schema either: the page says the value is changed first
            if (rule.check === 'overwrite') {
              expect(row, `${name} overwrite`).toContain('spaces at the start and end are removed')
              expect(rule.tx(' x ')).toBe('x')
            }
            if (rule.pattern) {
              expect(row, `${name} pattern`).toContain(
                // the schema's own pattern, in a code span: only a pipe is escaped for the table
                String(rule.pattern.source).replace(/\|/g, '\\|'),
              )
            }
          }
        }
        if (schema.options)
          for (const option of schema.options) expect(row, `${name} ${option}`).toContain(option)
        if (schema.element?.options) {
          for (const option of schema.element.options)
            expect(row, `${name} item ${option}`).toContain(option)
        }
        const required = !field.isOptional()
        expect(row, `${name} required`).toContain(`| ${required ? 'yes' : 'no'} |`)
      }
    }
  })
})

describe('the tools page names the whole-input schemas it says are not listed', () => {
  it('finds both in the tools’ schema file, parsed by the handlers', () => {
    const read = (file) =>
      fs.readFileSync(path.join(root, 'src/modules/agents/cms/tools', file), 'utf8')
    for (const name of ['submitSuggestionInput', 'reportItemInput']) {
      expect(read('schemas.ts'), name).toContain(`export const ${name}`)
      expect(page('mcp-tools.md'), name).toContain(name)
    }
    expect(read('submitSuggestion.ts')).toContain('submitSuggestionInput.parse')
    expect(read('reportItem.ts')).toContain('reportItemInput.parse')
  })
})
