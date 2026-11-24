/**
 * Reads everything the endpoints, AI agent tools, and jobs and schedules pages and the
 * content-type pages need (#1461): the loaded Payload config, the MCP plugin options, the route
 * files, the source (through the program it is given) and the files that set timers. The pure
 * parts that turn these into pages are in the sibling modules; this one only reads.
 *
 * Run through `tsx`, which resolves the `@payload-config` alias and loads the TypeScript config.
 */
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'

import { describeContentType } from '../content-types/describe.mjs'
import { pinEnvironment } from '../content-types/environment.mjs'
import { createLocator } from '../content-types/locate.mjs'
import { describeApi } from './endpoints.mjs'
import { describeJobs, jobRoutes } from './jobs.mjs'
import { describeMcp, toolNamesByCollection } from './mcpTools.mjs'
import { pluginDefining } from './pluginSlugs.mjs'
import { collectAppFiles, publicEntries } from './metadataRoutes.mjs'
import { ROUTES_ROOT, collectRoutes } from './routes.mjs'
import {
  parseDependabot,
  parseIntelligenceSchedule,
  parseServerCrons,
  parseTimedWorkflows,
} from './timers.mjs'
import { findCollectionCalls } from './collectionCalls.mjs'
import {
  findDefinitions,
  findPluginConfigurers,
  findServerActions,
  ownerOf,
} from './sourceFacts.mjs'

const PAYLOAD_ROUTES = 'src/app/(payload)'
const CONFIG_FILE = 'src/payload.config.ts'
// The GraphQL settings that say what the API allows; the rest of the block is paths and rules
const GRAPHQL_SETTINGS = [
  'disableIntrospectionInProduction',
  'disablePlaygroundInProduction',
  'maxComplexity',
]

const readFile = (root, file) => ({ file, text: fs.readFileSync(path.join(root, file), 'utf8') })

const filesIn = (root, folder, pattern) =>
  fs
    .readdirSync(path.join(root, folder))
    .filter((name) => pattern.test(name))
    .sort()
    .map((name) => readFile(root, `${folder}/${name}`))

/** Route handlers and pages of both route groups, with the path from the repository root. */
function collectAllRoutes(root) {
  return [ROUTES_ROOT, PAYLOAD_ROUTES].flatMap((folder) =>
    collectRoutes(root, folder).map((row) => ({ ...row, file: `${folder}/${row.file}`, folder })),
  )
}

/** Rules a GraphQL request is checked against; the function is called with no request. */
function graphQLRules(config) {
  try {
    return config.graphQL.validationRules?.({}) ?? []
  } catch {
    return []
  }
}

/** Every file a content type's functions were written in: access, hooks, endpoints, field hooks. */
const functionFiles = (model) =>
  [
    ...model.access,
    ...model.hooks,
    ...model.allEndpoints,
    ...model.fields.flatMap((row) => row.hooks ?? []),
  ].map((entry) => entry.file)

/**
 * The owner of each content type: the module that defines it, or the plugin that makes it (found
 * from the package its functions come from) with the modules that configure that plugin.
 */
function ownerText(model, defined, configurers, root) {
  const owner = ownerOf(defined.get(model.slug) ?? [])
  if (owner.file) return owner
  const plugin =
    functionFiles(model).find((file) => file.startsWith('@payloadcms/plugin-')) ||
    pluginDefining(root, model.slug, [...configurers.keys()])
  if (!plugin) return owner
  const modules = configurers.get(plugin) ?? []
  const by =
    modules.length > 0
      ? `, configured with code from ${modules.map((m) => `module \`${m}\``).join(' and ')}`
      : ''
  return { owner: `the plugin \`${plugin}\`${by}`, file: '' }
}

function describeModels(config, program, root, options) {
  const entries = [
    ...config.collections.map((entry) => ({ entry, kind: 'collection' })),
    ...config.globals.map((entry) => ({ entry, kind: 'global' })),
  ]
  const defined = findDefinitions(program, root)
  const configurers = findPluginConfigurers(program, root, CONFIG_FILE)
  return entries.map(({ entry, kind }) => {
    const model = describeContentType(entry, kind, options)
    return {
      ...model,
      owner: ownerText(model, defined, configurers, root),
      rest: entry.endpoints !== false,
    }
  })
}

function describeAgentTools(models, { program, root, locate }, mcpOptions) {
  const slugs = new Set(models.map((model) => model.slug))
  return describeMcp(mcpOptions, {
    locate,
    access: new Map(models.map((model) => [model.slug, model.access])),
    calls: (file, name) => findCollectionCalls(program, root, file, { name, knownSlugs: slugs }),
    schemaOf: (shape) => z.toJSONSchema(z.object(shape)),
  })
}

function describeScheduledWork(config, models, { program, root, locate }) {
  const slugs = new Set(models.map((model) => model.slug))
  const jobsCollection = config.collections.find((collection) => collection.slug === 'payload-jobs')
  const routes = jobRoutes(jobsCollection?.endpoints ?? [], `${config.routes.api}/payload-jobs`)
  const jobs = describeJobs(
    config.jobs,
    locate,
    (file, name) => findCollectionCalls(program, root, file, { name, knownSlugs: slugs }),
    { endpoints: routes },
  )
  return {
    jobs,
    workflows: parseTimedWorkflows(filesIn(root, '.github/workflows', /\.ya?ml$/)),
    extras: {
      serverCrons: parseServerCrons(filesIn(root, 'ops', /\.sh$/)),
      intelligence: parseIntelligenceSchedule(readFile(root, 'intelligence/pipeline.yaml')),
      dependabot: parseDependabot(readFile(root, '.github/dependabot.yml')),
    },
  }
}

function describeEndpointPages(config, models, mcp, { program, root, locate }) {
  const routes = collectAllRoutes(root)
  return describeApi(
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
      contentTypes: models,
      routeHandlers: routes.filter((row) => row.kind === 'route handler'),
      adminPages: routes
        .filter((row) => row.folder === PAYLOAD_ROUTES && row.kind === 'page')
        .map((row) => ({ url: row.url, file: row.file })),
      appFiles: collectAppFiles(root),
      publicFiles: publicEntries(root),
      serverActions: findServerActions(program, root),
      mcpAuth: mcp.auth,
    },
    locate,
  )
}

/** Everything read from the loaded config and the source, for the pages and the content types. */
export async function loadFacts({ root, program }) {
  // Fixed, so the output never depends on the machine's environment (see environment.mjs)
  pinEnvironment()
  const { loadConfig } = await import('../../src/platform/payload/testing/accessHarness.ts')
  const { mcpOptions } = await import('../../src/modules/agents/cms.ts')
  const config = await loadConfig()
  const { locate, close } = createLocator(root)
  try {
    const context = { program, root, locate }
    const models = describeModels(config, program, root, { locate, root })
    const mcp = describeAgentTools(models, context, mcpOptions)
    const scheduled = describeScheduledWork(config, models, context)
    const tools = toolNamesByCollection(mcp)
    for (const model of models) {
      model.tools = tools.get(model.slug) ?? []
      model.jobs = scheduled.jobs.tasks
        .filter((task) => task.collections.some((c) => c.collection === model.slug))
        .map((task) => task.slug)
    }
    return { models, mcp, scheduled, api: describeEndpointPages(config, models, mcp, context) }
  } finally {
    close()
  }
}
