/**
 * The data model of the map (#1462): a node for each collection and global with its fields, keys,
 * access and hooks, the blocks its layouts hold, and the relationships between content types
 * (fields that point at each other, joins, hooks written elsewhere). Read from the structured facts
 * of the loaded Payload config, never from the generated pages. Pure.
 */
import { makeEdge, makeNode, nodeId } from './graph.mjs'

const PAYLOAD_AREA = nodeId('platform-area', 'payload')
const REFERENCE = (slug) => `docs/reference/content-types/${slug}.md`
const typeOf = (model) => (model.kind === 'global' ? 'global' : 'collection')
const idOf = (model) => nodeId(typeOf(model), model.slug)

/** The area that holds a content type: its defining file's area, the first module that configures its plugin, or Payload. */
function parentOf(model, ownerOf) {
  const byFile = model.owner.file ? ownerOf(model.owner.file) : null
  if (byFile) return byFile.top
  const [first] = [...(model.owner.modules ?? [])].sort()
  return first ? nodeId('module', first) : PAYLOAD_AREA
}

const asText = (rows) => rows.join(', ')
const cardinality = (link) => (link.many ? 'many' : 'one')

function fieldFacts(model) {
  const rows = model.fields
  const named = (pick) => rows.filter(pick).map((row) => row.path)
  const facts = [
    { label: 'Kind', value: model.kind },
    { label: 'Owner', value: model.owner.owner },
    { label: 'Primary key', value: 'id (set by Payload)' },
  ]
  const unique = named((row) => row.unique)
  const indexed = named((row) => row.indexed)
  if (unique.length > 0) facts.push({ label: 'Unique fields', value: asText(unique) })
  if (indexed.length > 0) facts.push({ label: 'Indexed fields', value: asText(indexed) })
  if (model.versions.length > 0) facts.push({ label: 'Versions', value: model.versions.join('; ') })
  if (model.access.length > 0) {
    facts.push({
      label: 'Access',
      value: model.access.map((a) => `${a.operation}: ${a.name}`).join('; '),
    })
  }
  if (model.hooks.length > 0) {
    facts.push({ label: 'Hooks', value: model.hooks.map((h) => `${h.phase} ${h.name}`).join('; ') })
  }
  if (model.tools.length > 0) facts.push({ label: 'AI agent tools', value: asText(model.tools) })
  facts.push({ label: 'GraphQL', value: model.graphQL ? 'yes' : 'no' })
  return facts
}

const fieldRowOf = (row) => ({
  name: row.path,
  type: row.type,
  required: row.required === 'yes',
  detail: row.detail,
  notes: row.notes,
})

/** The block slugs a content type's layouts hold, in order, once each (rows `layout{cta}`). */
const blockSlugs = (model) =>
  [
    ...new Set(
      model.fields
        .filter((row) => row.type === 'block')
        .map((row) => /\{([^}]+)\}/.exec(row.path)?.[1]),
    ),
  ].filter(Boolean)

function referenceEdges(model, byId, edges, gaps) {
  const from = idOf(model)
  const vias = new Map()
  const add = (type, target, via) => {
    const key = `${type}\0${target}`
    vias.set(key, [...(vias.get(key) ?? []), via])
  }
  for (const row of model.fields) {
    if (row.link?.to) {
      for (const slug of row.link.to) {
        if (byId.has(slug)) add('references', slug, `${row.path} (${cardinality(row.link)})`)
        else
          gaps.push({
            kind: 'reference-target-missing',
            node: from,
            message: `field ${row.path} points at "${slug}", which is not a content type`,
          })
      }
    }
    for (const slug of row.link?.collections ?? []) {
      if (byId.has(slug)) add('joins', slug, `${row.path} ← ${slug}.${row.link.on}`)
      else
        gaps.push({
          kind: 'reference-target-missing',
          node: from,
          message: `field ${row.path} joins "${slug}", which is not a content type`,
        })
    }
  }
  for (const [key, via] of vias) {
    const [type, slug] = key.split('\0')
    edges.push(makeEdge({ from, to: byId.get(slug), type, count: via.length, via }))
  }
}

/** `{ nodes, edges, gaps }` for the content types; `database` is the package of the database adapter, or ''. */
export function buildContentTypes({ models, ownerOf, database }) {
  const nodes = []
  const edges = []
  const gaps = []
  const byId = new Map(models.map((model) => [model.slug, idOf(model)]))
  const blocks = new Map()

  for (const model of [...models].sort((a, b) => (idOf(a) < idOf(b) ? -1 : 1))) {
    const id = idOf(model)
    const parent = parentOf(model, ownerOf)
    nodes.push(
      makeNode({
        id,
        type: typeOf(model),
        name: model.slug,
        summary: model.purpose,
        path: model.owner.file || REFERENCE(model.slug),
        module: parent,
        fields: model.fields.filter((row) => row.type !== 'block').map(fieldRowOf),
        facts: fieldFacts(model),
        links: [REFERENCE(model.slug)],
      }),
    )
    edges.push(makeEdge({ from: parent, to: id, type: 'contains' }))
    referenceEdges(model, byId, edges, gaps)
    for (const hook of model.hooks) {
      const area = hook.file.startsWith('src/') ? ownerOf(hook.file) : null
      if (area && area.top !== parent) {
        edges.push(
          makeEdge({ from: area.top, to: id, type: 'hooks', via: [`${hook.phase} ${hook.name}`] }),
        )
      }
    }
    if (database)
      edges.push(
        makeEdge({ from: id, to: nodeId('library', database), type: 'uses', via: ['database'] }),
      )
    for (const slug of blockSlugs(model)) {
      const first = !blocks.has(slug)
      if (first) {
        blocks.set(slug, true)
        nodes.push(
          makeNode({
            id: nodeId('block', slug),
            type: 'block',
            name: slug,
            summary: `A block an editor places in the layout of ${model.slug}.`,
            path: model.owner.file || REFERENCE(model.slug),
            module: parent,
            links: [REFERENCE(model.slug)],
          }),
        )
      }
      edges.push(
        makeEdge({ from: id, to: nodeId('block', slug), type: first ? 'contains' : 'uses' }),
      )
    }
  }
  return { nodes, edges, gaps }
}
