/**
 * The pure parts of `scripts/agent-context.mjs`: reading the load map and the knowledge map, and
 * matching globs. They import nothing but Node, so the `PR Policy` workflow (which installs no
 * packages) can load them through `.github/scripts/knowledge-sync.mjs` without the token counter (#737).
 */

import path from 'node:path'

export const LOAD_MAP = 'docs/guidelines/README.md'
export const KNOWLEDGE_MAP = 'docs/knowledge/map.json'

const LOAD_COLUMN = /loads by itself/i
/** What the load column says for a reference that has no globs on purpose. */
const NO_GLOBS = /^\s*(no\b|always\b)/i

/** Normalizes Windows line endings, so a checkout with `autocrlf` reads the same. */
export const unix = (text) => text.replace(/\r\n/g, '\n')

/**
 * Reads the load map: every table row whose load column holds backticked globs. A row with a link
 * whose load column has no globs and doesn't start with "No" or "Always" throws, so a mistyped
 * row fails instead of being dropped.
 */
export function parseLoadMap(markdown, mapPath = LOAD_MAP) {
  const entries = []
  let column = -1
  for (const line of unix(markdown).split('\n')) {
    if (!line.trim().startsWith('|')) {
      column = -1
      continue
    }
    const cells = line.split('|').slice(1, -1)
    if (column === -1) {
      column = cells.findIndex((cell) => LOAD_COLUMN.test(cell))
      continue
    }
    if (/^\s*:?-+:?\s*$/.test(cells[0])) continue
    const link = cells[0].match(/\]\(([^)#]+\.md)(?:#[^)]*)?\)/)
    const globs = [...(cells[column] ?? '').matchAll(/`([^`]+)`/g)].map((match) => match[1])
    if (!link) continue
    if (globs.length === 0) {
      if (NO_GLOBS.test(cells[column] ?? '')) continue
      throw new Error(
        `${mapPath}: the row for ${link[1]} has no backticked globs; write them, or "No" or "Always"`,
      )
    }
    entries.push({
      source: path.posix.normalize(path.posix.join(path.posix.dirname(mapPath), link[1])),
      paths: globs,
    })
  }
  return entries
}

/**
 * Reads the knowledge map (decision 0019, §5): a JSON list of `{ note, paths }`, one per note,
 * giving the paths the note describes. Each entry becomes a path-scoped rule like a guideline's.
 * Throws on a map it would misread, so a mistyped entry fails instead of being dropped.
 */
export function parseKnowledgeMap(json, mapPath = KNOWLEDGE_MAP) {
  let list
  try {
    list = JSON.parse(json)
  } catch (error) {
    throw new Error(`${mapPath} is not valid JSON: ${error.message}`)
  }
  if (!Array.isArray(list)) throw new Error(`${mapPath} must be a list of { note, paths }`)
  return list.map((entry, index) => {
    const { note, paths } = entry ?? {}
    const valid =
      typeof note === 'string' &&
      note.endsWith('.md') &&
      Array.isArray(paths) &&
      paths.length > 0 &&
      paths.every((glob) => typeof glob === 'string' && glob !== '')
    if (!valid) {
      throw new Error(
        `${mapPath}: entry ${index + 1} needs a "note" (a .md path) and a non-empty "paths" list of globs`,
      )
    }
    return { source: note, paths, origin: mapPath }
  })
}

/**
 * A glob as Claude Code reads it (`**`, `*`, `?`), as a regular expression over posix paths.
 * Braces (`{a,b}`) are valid in Claude Code but not handled here: they are read literally, match
 * no file, and the check fails, so write one glob per alternative instead.
 */
export function globToRegExp(glob) {
  let pattern = ''
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i]
    if (char === '*' && glob[i + 1] === '*') {
      const slash = glob[i + 2] === '/'
      pattern += slash ? '(?:.*/)?' : '.*'
      i += slash ? 2 : 1
    } else if (char === '*') pattern += '[^/]*'
    else if (char === '?') pattern += '[^/]'
    else pattern += char.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${pattern}$`)
}
