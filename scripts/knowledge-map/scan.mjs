/**
 * The scan (#1462): every input of the repository, turned by the builders into parts, joined into
 * one checked graph. Pure: the files, a way to read them and the facts are given, so the same
 * inputs always give the same graph.
 */
import { parseKnowledgeMap } from '../agent-context-maps.mjs'
import { buildApi } from './api.mjs'
import { buildAreas, SITE_ID } from './areas.mjs'
import { buildComponents } from './components.mjs'
import { buildContentTypes } from './contentTypes.mjs'
import { assemble, nodeId } from './graph.mjs'
import { buildImports } from './imports.mjs'
import { buildJobs } from './jobs.mjs'
import { readNote } from './notes.mjs'
import { resolvePathTargets } from './paths.mjs'
import { buildProcess, classify } from './process.mjs'
import { buildScheduledTasks } from './scheduled.mjs'
import { buildScreens } from './screens.mjs'
import { buildTools } from './tools.mjs'
import { vocabulary } from './vocabulary.mjs'
import { buildWorkflows } from './workflows.mjs'

const SCHEDULED_PAGE = 'docs/knowledge/scheduled-tasks.md'
const WORKFLOWS = /^\.github\/workflows\/[^/]+\.ya?ml$/
const SOURCE = /^src\/.*\.(ts|tsx)$/

const groupId = (key) => nodeId('group', key)

/** Whether a repository path (a file, or a folder holding files) exists in the list. */
const existsIn = (files) => {
  const set = new Set(files)
  const folders = new Set(
    files.flatMap((file) =>
      file
        .split('/')
        .slice(0, -1)
        .map((_, i, parts) => parts.slice(0, i + 1).join('/')),
    ),
  )
  return (target) => set.has(target) || folders.has(target)
}

/**
 * `{ graph, errors }`. `inputs`: `schema`, `files` (every repository file), `read(file)`, `mapJson`,
 * `facts` ({ models, api, mcp, scheduled }), `components`, `componentUsers`, `routes`, `packageJson`.
 */
export function scanGraph(inputs) {
  const { schema, read, facts } = inputs
  const files = [...inputs.files].sort()
  const mapEntries = parseKnowledgeMap(inputs.mapJson)
  const notes = mapEntries
    .filter((entry) => files.includes(entry.source))
    .map((entry) => readNote(entry.source, read(entry.source), { schema, files }))
  const areas = buildAreas({ files, notes, mapEntries })
  const { ownerOf } = areas
  const areaIds = areas.nodes
    .filter((n) => ['module', 'platform-area'].includes(n.type))
    .map((n) => n.id)
  const moduleIds = areas.nodes.filter((n) => n.type === 'module').map((n) => n.id)
  const dependencies = inputs.packageJson.dependencies ?? {}
  const database =
    Object.keys(dependencies).find((name) => name.startsWith('@payloadcms/db-')) ?? ''

  const contentTypes = buildContentTypes({ models: facts.models, ownerOf, database })
  const typeNodes = contentTypes.nodes.filter((n) => n.type === 'collection' || n.type === 'global')
  const typeIds = typeNodes.map((n) => n.id)
  const screens = buildScreens({
    routes: inputs.routes,
    adminPages: facts.api.adminPages,
    moduleIds,
    contentTypeIds: typeIds,
    siteId: SITE_ID,
  })
  const api = buildApi({ api: facts.api, contentTypes: typeNodes, ownerOf, siteId: SITE_ID })
  const holderId = ownerOf(facts.mcp.auth.file)?.top ?? SITE_ID
  const tools = buildTools({
    mcp: facts.mcp,
    contentTypeIds: typeIds,
    holderId,
    endpointId: nodeId('endpoint', `mcp:${facts.api.mcp.path}`),
  })
  const jobs = buildJobs({
    scheduled: facts.scheduled,
    contentTypeIds: typeIds,
    ownerOf,
    payloadId: nodeId('platform-area', 'payload'),
  })
  const components = buildComponents({
    components: inputs.components,
    users: inputs.componentUsers,
    ownerOf,
    screenByFile: screens.screenByFile,
  })
  const imports = buildImports({
    sources: files.filter((f) => SOURCE.test(f)).map((file) => ({ file, text: read(file) })),
    dependencies,
    ownerOf,
    areaIds,
    siteId: SITE_ID,
  })
  const docs = files
    .filter((f) => f.endsWith('.md') && classify(f))
    .map((path) => ({ path, text: read(path) }))
  const process = buildProcess({ docs, files, siteId: SITE_ID })
  const workflows = buildWorkflows({
    workflows: files.filter((f) => WORKFLOWS.test(f)).map((path) => ({ path, text: read(path) })),
    groupId: groupId('ci'),
  })
  const scheduled = buildScheduledTasks({
    page: { path: SCHEDULED_PAGE, text: read(SCHEDULED_PAGE) },
    extras: facts.scheduled.extras,
    groupId: groupId('scheduled-tasks'),
  })

  const parts = resolvePathTargets([
    areas,
    contentTypes,
    screens,
    api,
    tools,
    jobs,
    components,
    imports,
    process,
    workflows,
    scheduled,
  ])
  return assemble(parts, { exists: existsIn(files), vocab: vocabulary(schema) })
}
