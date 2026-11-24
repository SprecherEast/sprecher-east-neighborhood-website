/**
 * Writes the generated reference (decision 0019 §4) and checks that the committed pages are current.
 *
 *   npm run docs:generate    write docs/reference/
 *   npm run docs:check       regenerate in memory and fail if anything differs from what is committed
 *
 * Content types (#714): loads the real Payload config with `loadConfig` from the access-policy
 * tests, no database and no server; the pure parts are in scripts/content-types/. Screens and
 * shared components (#718): the TypeScript compiler API reads src/; the pure parts are in
 * scripts/reference/. UI element coverage (#495): read from the element tables in docs/ui/.
 * Endpoints, AI agent tools, and jobs and schedules (#1461): read from the same loaded config, the
 * MCP plugin options, the route files, the source (which collections a tool or task reaches) and
 * the timed GitHub workflows; the owner of each content type is the module that defines it.
 *
 * Run through `tsx`, which resolves the `@payload-config` alias from tsconfig.json and loads the
 * TypeScript config.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import prettier from 'prettier'
import ts from 'typescript'
import { z } from 'zod'

import { compareFiles, describeDifferences } from './content-types/compare.mjs'
import { describeContentType } from './content-types/describe.mjs'
import { pinEnvironment } from './content-types/environment.mjs'
import { createLocator } from './content-types/locate.mjs'
import { PAGE_LINE_LIMIT, buildPages } from './content-types/render.mjs'
import {
  ELEMENT_FILES,
  buildCoverage,
  parseElementRows,
  renderCoverage,
} from './reference/coverage.mjs'
import { COMPONENT_GROUPS } from './reference/componentGroups.mjs'
import {
  describeComponents,
  findUsers,
  groupComponents,
  renderComponentIndex,
  renderComponentPage,
} from './reference/components.mjs'
import { describeApi, renderApi } from './reference/endpoints.mjs'
import { describeJobs, parseTimedWorkflows, renderJobs } from './reference/jobs.mjs'
import { describeMcp, renderMcp, toolNamesByCollection } from './reference/mcpTools.mjs'
import { ROUTES_ROOT, collectRoutes, renderRoutes } from './reference/routes.mjs'
import { findCollectionCalls, findDefinitions, ownerOf } from './reference/sourceFacts.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUTPUT = 'docs/reference'

const PAYLOAD_ROUTES = 'src/app/(payload)'
const WORKFLOWS = '.github/workflows'
// The GraphQL settings that say what the API allows; the rest of the block is paths and rules
const GRAPHQL_SETTINGS = [
  'disableIntrospectionInProduction',
  'disablePlaygroundInProduction',
  'maxComplexity',
]

/** Route handlers of both route groups, with the path from the repository root. */
function collectRouteHandlers() {
  return [ROUTES_ROOT, PAYLOAD_ROUTES].flatMap((folder) =>
    collectRoutes(ROOT, folder)
      .filter((row) => row.kind === 'route handler')
      .map((row) => ({ url: row.url, methods: row.methods, file: `${folder}/${row.file}` })),
  )
}

function readWorkflows() {
  const directory = path.join(ROOT, WORKFLOWS)
  return fs
    .readdirSync(directory)
    .filter((name) => /\.ya?ml$/.test(name))
    .sort()
    .map((name) => ({
      file: `${WORKFLOWS}/${name}`,
      text: fs.readFileSync(path.join(directory, name), 'utf8'),
    }))
}

/** Rules a GraphQL request is checked against; the function is called with no request. */
function graphQLRules(config) {
  try {
    return config.graphQL.validationRules?.({}) ?? []
  } catch {
    return []
  }
}

/** Everything read from the loaded config: the content types, endpoints, AI agent tools and jobs. */
async function loadFacts(program) {
  // Fixed, so the output never depends on the machine's environment (see environment.mjs)
  pinEnvironment()
  const { loadConfig } = await import('../src/platform/payload/testing/accessHarness.ts')
  const { mcpOptions } = await import('../src/modules/agents/cms.ts')
  const config = await loadConfig()
  const { locate, close } = createLocator(ROOT)
  try {
    const options = { locate, root: ROOT }
    const entries = [
      ...config.collections.map((entry) => ({ entry, kind: 'collection' })),
      ...config.globals.map((entry) => ({ entry, kind: 'global' })),
    ]
    const definitions = findDefinitions(program, ROOT)
    const models = entries.map(({ entry, kind }) => ({
      ...describeContentType(entry, kind, options),
      owner: ownerOf(definitions.get(entry.slug) ?? []),
    }))
    const slugs = new Set(models.map((model) => model.slug))
    const callsOf = (file) => findCollectionCalls(program, ROOT, file, slugs)
    const access = new Map(models.map((model) => [model.slug, model.access]))
    const mcp = describeMcp(mcpOptions, {
      locate,
      access,
      calls: callsOf,
      schemaOf: (shape) => z.toJSONSchema(z.object(shape)),
    })
    const jobs = describeJobs(config.jobs, locate, callsOf)
    const tools = toolNamesByCollection(mcp)
    for (const model of models) {
      model.tools = tools.get(model.slug) ?? []
      model.jobs = jobs.tasks
        .filter((task) => task.collections.some((c) => c.collection === model.slug))
        .map((task) => task.slug)
    }
    const api = describeApi(
      {
        routes: config.routes,
        graphQL: {
          ...Object.fromEntries(
            GRAPHQL_SETTINGS.filter((key) => config.graphQL[key] !== undefined).map((key) => [
              key,
              config.graphQL[key],
            ]),
          ),
          rules: graphQLRules(config),
        },
        endpoints: config.endpoints,
        contentTypes: models.map((model, index) => ({
          ...model,
          rest: entries[index].entry.endpoints !== false,
        })),
        routeHandlers: collectRouteHandlers(),
        mcpAuth: mcp.auth,
      },
      locate,
    )
    return { models, api, mcp, jobs }
  } finally {
    close()
  }
}

/** The program for `src/`, with the project's own compiler options. */
function createSourceProgram() {
  const config = ts.readConfigFile(path.join(ROOT, 'tsconfig.json'), ts.sys.readFile)
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, ROOT)
  const srcRoot = `${ROOT}/src/`
  return {
    program: ts.createProgram({
      rootNames: parsed.fileNames.filter((file) => file.startsWith(srcRoot)),
      options: { ...parsed.options, incremental: false },
    }),
    fileNames: parsed.fileNames,
  }
}

const COMPONENT_SOURCE = /\/src\/platform\/(ui|richtext)\/.*\.tsx$/

function buildComponentPages({ program, fileNames }) {
  const files = fileNames
    .filter((file) => COMPONENT_SOURCE.test(file) && !/\.(test|contract)\.tsx$/.test(file))
    .filter((file) => !file.includes('/testing/'))
    .sort()
  const components = describeComponents(program, ROOT, files)
  const users = findUsers(program, ROOT, components)
  const groups = groupComponents(COMPONENT_GROUPS, components)
  const pages = new Map([['components/README.md', renderComponentIndex(groups)]])
  for (const group of groups) {
    pages.set(`components/${group.slug}.md`, renderComponentPage(group, group.components, users))
  }
  return pages
}

/** The element-to-component coverage page (#495), made from the element tables in docs/ui/. */
function buildCoveragePage() {
  const rows = ELEMENT_FILES.flatMap((file) =>
    parseElementRows(fs.readFileSync(path.join(ROOT, file), 'utf8')),
  )
  return renderCoverage(buildCoverage(rows))
}

async function formatted(files) {
  const config = (await prettier.resolveConfig(path.join(ROOT, OUTPUT, 'routes.md'))) ?? {}
  const out = new Map()
  for (const [file, text] of files) {
    // The Tailwind plugin only sorts class names; it does nothing to Markdown
    const page = await prettier.format(text, { ...config, plugins: [], parser: 'markdown' })
    const lines = page.trimEnd().split('\n').length
    if (lines > PAGE_LINE_LIMIT) {
      throw new Error(
        `${file} has ${lines} lines, over the limit of ${PAGE_LINE_LIMIT}: split its group`,
      )
    }
    out.set(file, page)
  }
  return out
}

/** Every Markdown file under the folder, keyed by its path inside it. */
function readCommitted(directory, prefix = '') {
  const found = new Map()
  if (!fs.existsSync(directory)) return found
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      for (const [key, text] of readCommitted(full, `${prefix}${entry.name}/`)) found.set(key, text)
    } else if (entry.name.endsWith('.md')) {
      found.set(`${prefix}${entry.name}`, fs.readFileSync(full, 'utf8'))
    }
  }
  return found
}

const started = Date.now()
const directory = path.join(ROOT, OUTPUT)
// The source facts use a program of their own: a type checker orders the members of a union by
// when it first met them, so sharing one with the component pages would reorder their prop types
const facts = await loadFacts(createSourceProgram().program)
const contentTypes = new Map(
  [...buildPages(facts.models)].map(([file, text]) => [`content-types/${file}`, text]),
)
const pages = await formatted(
  new Map([
    ...contentTypes,
    ['routes.md', renderRoutes(collectRoutes(ROOT))],
    ['ui-coverage.md', buildCoveragePage()],
    ['endpoints.md', renderApi(facts.api)],
    ['mcp-tools.md', renderMcp(facts.mcp)],
    ['jobs.md', renderJobs(facts.jobs, parseTimedWorkflows(readWorkflows()))],
    ...buildComponentPages(createSourceProgram()),
  ]),
)
const seconds = ((Date.now() - started) / 1000).toFixed(1)

if (process.argv.includes('--check')) {
  const message = describeDifferences(compareFiles(pages, readCommitted(directory)), OUTPUT)
  if (message) {
    console.error(message)
    process.exit(1)
  }
  console.log(`${OUTPUT} is current (${pages.size} pages, ${seconds} s).`)
} else {
  fs.mkdirSync(directory, { recursive: true })
  for (const file of readCommitted(directory).keys()) {
    if (!pages.has(file)) fs.rmSync(path.join(directory, file))
  }
  for (const [file, text] of pages) {
    fs.mkdirSync(path.dirname(path.join(directory, file)), { recursive: true })
    fs.writeFileSync(path.join(directory, file), text)
  }
  console.log(`Wrote ${pages.size} pages to ${OUTPUT} (${seconds} s).`)
}
