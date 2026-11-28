/**
 * Turns the targets that parts name by repository path (`path:src/...`) into node ids (#1462).
 * A link between documents resolves only to a document, or to the node a generated page describes;
 * a path a note writes by hand may also name a module or a folder, and stays as it is when nothing
 * matches, so the graph lists it as a gap rather than losing it.
 */
import path from 'node:path'

export const PATH_PREFIX = 'path:'

const DOCUMENT_TYPES = new Set([
  'note',
  'decision',
  'guideline',
  'process-doc',
  'skill',
  'role',
  'subagent',
  'rule',
  'scheduled-task',
  'ci-workflow',
])
const WRITTEN_ORDER = ['module', 'platform-area', 'feature', 'note']

const rank = (node) => {
  const index = WRITTEN_ORDER.indexOf(node.type)
  return index === -1 ? WRITTEN_ORDER.length : index
}
const byRankThenId = (a, b) => rank(a) - rank(b) || (a.id < b.id ? -1 : 1)

/** The parts with every `path:` target replaced by a node id, or dropped (a link) or kept (a written one). */
export function resolvePathTargets(parts) {
  const nodes = parts.flatMap((part) => part.nodes)
  const byPath = new Map()
  const add = (file, node) => byPath.set(file, [...(byPath.get(file) ?? []), node])
  for (const node of nodes) {
    add(node.path, node)
    for (const link of node.links) add(link, node)
  }
  const areaFolders = new Map(
    nodes
      .filter((node) => ['module', 'platform-area', 'feature'].includes(node.type))
      .map((node) => [path.posix.dirname(node.path), node]),
  )

  const resolve = (target, written) => {
    const candidates = byPath.get(target) ?? []
    if (written) {
      const [first] = [...candidates].sort(byRankThenId)
      return first ?? areaFolders.get(target.replace(/\/$/, ''))
    }
    const documents = candidates.filter(
      (node) => DOCUMENT_TYPES.has(node.type) || node.path !== target,
    )
    return documents.length === 1 || documents.every((n) => n.type === documents[0].type)
      ? [...documents].sort(byRankThenId)[0]
      : undefined
  }

  return parts.map((part) => ({
    ...part,
    edges: part.edges.flatMap((edge) => {
      if (!edge.to.startsWith(PATH_PREFIX)) return [edge]
      const found = resolve(edge.to.slice(PATH_PREFIX.length), Boolean(edge.written))
      if (found) return [{ ...edge, to: found.id }]
      return edge.written ? [edge] : []
    }),
  }))
}
