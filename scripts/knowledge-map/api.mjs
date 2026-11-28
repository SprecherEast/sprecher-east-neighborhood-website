/**
 * The ways into the application, as nodes (#1462): the REST endpoint of each content type, the
 * GraphQL endpoint, the custom endpoints, the route handlers, the server actions, the AI agent
 * endpoint and the files Next.js serves by name. Read from the structured endpoint facts. Pure.
 */
import { makeEdge, makeNode, nodeId } from './graph.mjs'

const CATCH_ALL = 'src/app/(payload)/api/[...slug]/route.ts'
const GRAPHQL_FILE = 'src/app/(payload)/api/graphql/route.ts'
// Handlers made into endpoints of their own elsewhere in this file
const COVERED = new Set(['/api/[...slug]', '/api/graphql'])

const graphQLOn = (type) =>
  type.facts.some((fact) => fact.label === 'GraphQL' && fact.value === 'yes')

/** `{ nodes, edges }`; `contentTypes` are the collection and global nodes, `ownerOf(file)` the area of a file. */
export function buildApi({ api, contentTypes, ownerOf, siteId }) {
  const nodes = []
  const edges = []
  const typeBySlug = new Map(contentTypes.map((type) => [type.id.split(':')[1], type]))
  const holder = (file) => ownerOf(file)?.top ?? siteId

  const add = (node, parent, exposes = []) => {
    nodes.push(makeNode({ ...node, module: parent }))
    edges.push(makeEdge({ from: parent, to: node.id, type: 'contains' }))
    for (const target of exposes)
      edges.push(makeEdge({ from: node.id, to: target, type: 'exposes' }))
  }

  for (const entry of api.rest.filter((rest) => rest.enabled)) {
    const type = typeBySlug.get(entry.slug)
    if (!type) continue
    add(
      {
        id: nodeId('endpoint', `rest:${entry.path}`),
        type: 'endpoint',
        name: entry.path,
        summary: `The REST API of ${entry.slug}: find, create, update and delete over HTTP.`,
        path: CATCH_ALL,
        links: [type.path],
        facts: [{ label: 'Address', value: entry.path }],
      },
      type.module,
      [type.id],
    )
  }

  add(
    {
      id: nodeId('endpoint', `graphql:${api.graphQL.path}`),
      type: 'endpoint',
      name: api.graphQL.path,
      summary: 'The GraphQL API Payload builds from the content types.',
      path: GRAPHQL_FILE,
      facts: [{ label: 'Address', value: api.graphQL.path }],
    },
    nodeId('platform-area', 'payload'),
    contentTypes.filter(graphQLOn).map((type) => type.id),
  )

  for (const entry of api.custom) {
    const file = entry.file.startsWith('src/') ? entry.file : CATCH_ALL
    const owner = typeBySlug.get(entry.owner)
    add(
      {
        id: nodeId('endpoint', `custom:${entry.method} ${entry.path}`),
        type: 'endpoint',
        name: `${entry.method} ${entry.path}`,
        summary: owner
          ? `A custom endpoint of ${entry.owner}.`
          : 'A custom endpoint set in the Payload config.',
        path: file,
        facts: [
          { label: 'Address', value: entry.path },
          { label: 'Method', value: entry.method },
          ...(entry.guard ? [{ label: 'Guard', value: entry.guard }] : []),
        ],
      },
      entry.file.startsWith('src/') ? holder(entry.file) : (owner?.module ?? siteId),
      owner ? [owner.id] : [],
    )
  }

  for (const handler of api.routeHandlers.filter((row) => !COVERED.has(row.url))) {
    add(
      {
        id: nodeId('endpoint', `route:${handler.url}`),
        type: 'endpoint',
        name: handler.url,
        summary: `A route handler (${handler.methods.join(', ')}) that answers with data, not a page.`,
        path: handler.file,
        facts: [
          { label: 'Address', value: handler.url },
          { label: 'Methods', value: handler.methods.join(', ') },
        ],
      },
      holder(handler.file),
    )
  }

  for (const action of api.serverActions) {
    add(
      {
        id: nodeId('endpoint', `action:${action.file}#${action.name}`),
        type: 'endpoint',
        name: action.name,
        summary: 'A server action: a POST endpoint the browser calls by itself.',
        path: action.file,
        facts: [{ label: 'Kind', value: 'server action' }],
      },
      holder(action.file),
    )
  }

  add(
    {
      id: nodeId('endpoint', `mcp:${api.mcp.path}`),
      type: 'endpoint',
      name: api.mcp.path,
      summary:
        'The address AI agents connect to; each request carries an API key that acts as an agent account.',
      path: api.mcp.auth.file,
      facts: [
        { label: 'Address', value: api.mcp.path },
        { label: 'Key check', value: api.mcp.auth.name },
      ],
    },
    holder(api.mcp.auth.file),
  )

  for (const file of api.appFiles) {
    add(
      {
        id: nodeId('endpoint', `file:${file.url}`),
        type: 'endpoint',
        name: file.url,
        summary: 'A file Next.js serves by name.',
        path: file.file,
        facts: [{ label: 'Address', value: file.url }],
      },
      siteId,
    )
  }
  return { nodes, edges, gaps: [] }
}
