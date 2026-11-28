/**
 * What changed and where (#1462): the last commit and date of each node, and the nodes each recent
 * commit changed, so the page can mark what changed since an earlier build. It changes with every
 * commit, so it is never part of the committed graph. Pure: the parsed `git log` is given.
 */
import path from 'node:path'

const RECORD = '\x1e'
const UNIT = '\x1f'
export const GIT_LOG_FORMAT = `${RECORD}%H${UNIT}%cI${UNIT}%s`
/** The commits kept, so a reader can pick an earlier build from them. */
export const COMMIT_LIMIT = 100
const AREA_TYPES = ['module', 'platform-area', 'feature']

/** The commits of `git log --name-only --format=GIT_LOG_FORMAT`, newest first. */
export function parseGitLog(text) {
  return text
    .split(RECORD)
    .filter((chunk) => chunk.trim())
    .map((chunk) => {
      const [header, ...rest] = chunk.split('\n')
      const [sha, date, subject] = header.split(UNIT)
      return { sha, date, subject, files: rest.map((line) => line.trim()).filter(Boolean) }
    })
}

/** The folder a node covers: an area's folder, or the folder a folder-path node names. */
const folderOf = (node) => {
  if (AREA_TYPES.includes(node.type))
    return node.path.endsWith('.md') ? path.posix.dirname(node.path) : node.path
  return path.extname(node.path) === '' ? node.path : null
}

/** The nodes a changed file belongs to. */
function nodesChanged(file, nodes) {
  return nodes
    .filter((node) => {
      const folder = folderOf(node)
      return (
        node.path === file ||
        node.links.includes(file) ||
        (folder !== null && file.startsWith(`${folder}/`))
      )
    })
    .map((node) => node.id)
}

/** `{ available, head, nodes: { id: { sha, date, subject } }, commits: [{ sha, date, subject, nodes }] }`. */
export function buildHistory({ graph, commits }) {
  if (commits.length === 0)
    return { available: false, reason: 'no history to read', head: '', nodes: {}, commits: [] }
  const last = {}
  const listed = []
  for (const commit of commits) {
    const changed = [
      ...new Set(commit.files.flatMap((file) => nodesChanged(file, graph.nodes))),
    ].sort()
    for (const id of changed)
      last[id] ??= { sha: commit.sha, date: commit.date, subject: commit.subject }
    if (changed.length > 0 && listed.length < COMMIT_LIMIT) {
      listed.push({ sha: commit.sha, date: commit.date, subject: commit.subject, nodes: changed })
    }
  }
  return {
    available: true,
    head: commits[0].sha,
    nodes: Object.fromEntries(Object.entries(last).sort(([a], [b]) => (a < b ? -1 : 1))),
    commits: listed,
  }
}
