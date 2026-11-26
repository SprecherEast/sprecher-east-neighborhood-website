/**
 * The page's model of the graph (#1463): who contains whom, who is connected to whom, and the
 * modules. Pure; the page and its tests share it. The tree comes from the `contains`
 * relationships; a note with no container sits under the part it documents, and whatever is
 * left sits under the site, so every node can be reached from the root.
 */

const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

/** The container of each node: its `contains` source, else what a note documents, else the root. */
function findParents(graph, rootId) {
  const parent = new Map()
  for (const edge of graph.edges) if (edge.type === 'contains') parent.set(edge.to, edge.from)
  for (const edge of graph.edges) {
    if (edge.type === 'documents' && !parent.has(edge.from)) parent.set(edge.from, edge.to)
  }
  for (const node of graph.nodes) {
    if (node.id !== rootId && !parent.has(node.id)) parent.set(node.id, rootId)
  }
  return parent
}

/** Breaks a cycle by sending a node that cannot reach the root to the root. */
function repairCycles(parent, rootId) {
  for (const id of parent.keys()) {
    const seen = new Set([id])
    let at = parent.get(id)
    while (at !== undefined && at !== rootId) {
      if (seen.has(at)) {
        parent.set(id, rootId)
        break
      }
      seen.add(at)
      at = parent.get(at)
    }
  }
}

/** The kinds of part the overview shows directly under the site; the rest wait in one bucket. */
export const OVERVIEW_TYPES = ['module', 'platform-area', 'group', 'feature', 'page-cluster']
export const BUCKET_ID = 'bucket:site-details'

/**
 * Gathers what sits loose under the site (screens and endpoints with no module) in one bucket, so
 * the overview stays a handful of parts. The bucket is the page's own, not part of the data.
 */
function bucketLooseParts(graph, root, parent, nodes) {
  const loose = graph.nodes.filter(
    (node) =>
      parent.get(node.id) === root && !OVERVIEW_TYPES.includes(node.type) && node.id !== root,
  )
  if (loose.length === 0) return
  nodes.set(BUCKET_ID, {
    id: BUCKET_ID,
    type: 'group',
    name: 'Screens and endpoints of the whole site',
    summary: 'Screens and endpoints that belong to no module.',
    path: '',
    module: '',
    aliases: [],
    fields: [],
    facts: [],
    watchOuts: [],
    links: [],
    virtual: true,
  })
  parent.set(BUCKET_ID, root)
  for (const node of loose) parent.set(node.id, BUCKET_ID)
}

/** `{ graph, root, nodes, parent, children, depth, links, modules }`. */
export function buildModel(graph) {
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]))
  const root = (graph.nodes.find((node) => node.type === 'site') ?? graph.nodes[0])?.id ?? null
  const parent = findParents(graph, root)
  repairCycles(parent, root)
  bucketLooseParts(graph, root, parent, nodes)
  const children = new Map()
  for (const id of nodes.keys()) children.set(id, [])
  for (const [id, up] of parent) children.get(up)?.push(id)
  for (const list of children.values()) list.sort(compare)

  const depth = new Map()
  const stack = root ? [[root, 0]] : []
  while (stack.length > 0) {
    const [id, d] = stack.pop()
    depth.set(id, d)
    for (const child of children.get(id)) stack.push([child, d + 1])
  }

  const links = new Map([...nodes.keys()].map((id) => [id, []]))
  graph.edges.forEach((edge, index) => {
    if (edge.type === 'contains') return
    links.get(edge.from)?.push({ index, other: edge.to, outgoing: true })
    links.get(edge.to)?.push({ index, other: edge.from, outgoing: false })
  })
  const modules = graph.nodes.filter((node) => node.type === 'module').map((node) => node.id)
  return { graph, root, nodes, parent, children, depth, links, modules }
}

/** The ancestors of a node, nearest first, ending at the root. */
export function ancestors(model, id) {
  const out = []
  for (let at = model.parent.get(id); at !== undefined; at = model.parent.get(at)) out.push(at)
  return out
}

/** The module a node belongs to: its own `module` field, else the nearest module above it. */
export function moduleOf(model, id) {
  const node = model.nodes.get(id)
  if (node?.module) return node.module
  if (node?.type === 'module') return id
  return ancestors(model, id).find((up) => model.nodes.get(up)?.type === 'module') ?? null
}
