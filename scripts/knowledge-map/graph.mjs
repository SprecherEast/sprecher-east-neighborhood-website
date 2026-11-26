/**
 * The graph of the system map (#1462): what a node and a relationship are, and how the parts the
 * builders return become one sorted, checked graph. Pure: the same parts always give the same
 * graph, whatever order they arrive in.
 */
import { REPOSITORY, layerOf } from './vocabulary.mjs'

export const GRAPH_VERSION = 1

/** A node id from its type and a key that is stable across runs (a path, a slug, a name). */
export const nodeId = (type, key) => `${type}:${key}`

const REQUIRED = ['id', 'type', 'name', 'path']

/**
 * A node. `path` is the repository-relative file or folder that opens it. `module` is the id of
 * the module or area it belongs to (for the one-module view). `fields` are rows `{ name, type,
 * required, detail, notes }`, `facts` rows `{ label, value }`, `links` the generated pages and
 * other files that describe it, `watchOuts` plain sentences.
 */
export function makeNode(given) {
  for (const key of REQUIRED) {
    if (!given[key]) throw new Error(`a node needs a ${key}: ${JSON.stringify(given)}`)
  }
  return {
    id: given.id,
    type: given.type,
    name: given.name,
    summary: given.summary ?? '',
    path: given.path,
    module: given.module ?? '',
    aliases: given.aliases ?? [],
    fields: given.fields ?? [],
    facts: given.facts ?? [],
    watchOuts: given.watchOuts ?? [],
    links: given.links ?? [],
  }
}

/** A relationship. `written: true` marks one a person wrote in a note, whose target may be wrong. */
export function makeEdge({ from, to, type, count = 1, via = [], written = false }) {
  const edge = { from, to, type, count, via }
  return written ? { ...edge, written } : edge
}

const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0)
const byKeys =
  (...keys) =>
  (a, b) => {
    for (const key of keys) {
      const order = compare(a[key], b[key])
      if (order !== 0) return order
    }
    return 0
  }

function checkedNodes(parts, { exists, vocab }, errors) {
  const nodes = new Map()
  for (const node of parts.flatMap((part) => part.nodes)) {
    if (nodes.has(node.id)) {
      errors.push({ rule: 'NODE-DUPLICATE', node: node.id, message: 'two nodes have this id' })
      continue
    }
    nodes.set(node.id, node)
    if (!vocab.nodeTypes[node.type]) {
      errors.push({
        rule: 'NODE-TYPE',
        node: node.id,
        message: `type "${node.type}" is not in the vocabulary`,
      })
    }
    if (!exists(node.path)) {
      errors.push({
        rule: 'NODE-PATH',
        node: node.id,
        message: `path "${node.path}" does not exist`,
      })
    }
  }
  return nodes
}

function checkedEdges(parts, nodes, vocab, errors, gaps) {
  const merged = new Map()
  for (const edge of parts.flatMap((part) => part.edges)) {
    if (!vocab.edgeTypes[edge.type]) {
      errors.push({
        rule: 'EDGE-TYPE',
        node: edge.from,
        message: `relationship type "${edge.type}" is not in the vocabulary`,
      })
      continue
    }
    const missing = [edge.from, edge.to].find((id) => !nodes.has(id))
    if (missing) {
      const message = `${edge.type} "${edge.to}", which is not a node`
      if (edge.written) gaps.push({ kind: 'relationship-target-missing', node: edge.from, message })
      else errors.push({ rule: 'EDGE-TARGET', node: edge.from, message })
      continue
    }
    const key = `${edge.from}\0${edge.to}\0${edge.type}`
    const seen = merged.get(key)
    if (seen) {
      seen.count += edge.count
      seen.via = [...new Set([...seen.via, ...edge.via])].sort()
    } else {
      merged.set(key, {
        from: edge.from,
        to: edge.to,
        type: edge.type,
        layer: layerOf({
          type: edge.type,
          fromType: nodes.get(edge.from).type,
          toType: nodes.get(edge.to).type,
        }),
        count: edge.count,
        via: [...new Set(edge.via)].sort(),
      })
    }
  }
  return [...merged.values()].sort(byKeys('from', 'to', 'type'))
}

/** Every node but the site has exactly one `contains` parent: a node with none, or two, is an error. */
function checkParents(nodes, edges, errors) {
  const parents = new Map()
  for (const edge of edges) {
    if (edge.type === 'contains') parents.set(edge.to, [...(parents.get(edge.to) ?? []), edge.from])
  }
  for (const node of nodes.values()) {
    if (node.type === 'site') continue
    const found = (parents.get(node.id) ?? []).sort()
    if (found.length === 1) continue
    const message =
      found.length === 0
        ? 'has no parent: nothing contains it'
        : `has ${found.length} parents: ${found.join(', ')}`
    errors.push({ rule: 'NODE-PARENT', node: node.id, message })
  }
}

/** The vocabulary the page draws its legend from: each relationship type with the layers it is seen on. */
function legend(vocab, nodes, edges) {
  const edgeTypes = {}
  for (const edge of edges) {
    const entry = (edgeTypes[edge.type] ??= { what: vocab.edgeTypes[edge.type], layers: [] })
    if (!entry.layers.includes(edge.layer)) entry.layers.push(edge.layer)
  }
  for (const entry of Object.values(edgeTypes)) entry.layers.sort()
  const used = new Set(nodes.map((node) => node.type))
  const nodeTypes = Object.fromEntries(
    Object.entries(vocab.nodeTypes).filter(([key]) => used.has(key)),
  )
  return {
    nodeTypes: Object.fromEntries(Object.entries(nodeTypes).sort(([a], [b]) => compare(a, b))),
    edgeTypes: Object.fromEntries(Object.entries(edgeTypes).sort(([a], [b]) => compare(a, b))),
  }
}

/**
 * The graph from the parts `{ nodes, edges, gaps? }`, and the errors that must fail the run: a path
 * that does not exist, a duplicate id, a type outside the vocabulary, a node with no `contains` parent (or
 * two), a derived relationship whose end is not a node. A written relationship to a missing node is a gap instead.
 */
export function assemble(parts, { exists, vocab }) {
  const errors = []
  const gaps = parts.flatMap((part) => part.gaps ?? [])
  const nodes = checkedNodes(parts, { exists, vocab }, errors)
  const edges = checkedEdges(parts, nodes, vocab, errors, gaps)
  checkParents(nodes, edges, errors)
  const sortedNodes = [...nodes.values()].sort(byKeys('id'))
  const graph = {
    version: GRAPH_VERSION,
    repository: REPOSITORY,
    layers: vocab.layers,
    ...legend(vocab, sortedNodes, edges),
    nodes: sortedNodes,
    edges,
    gaps: gaps.sort(byKeys('kind', 'node', 'message')),
  }
  return { graph, errors }
}
