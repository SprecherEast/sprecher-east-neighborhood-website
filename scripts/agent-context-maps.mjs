/**
 * The pure parts of `scripts/agent-context.mjs`: reading the load map and the knowledge map, and
 * matching globs. They import nothing but Node, so the `PR Policy` workflow (which installs no
 * packages) can load them through `.github/scripts/knowledge-sync.mjs` without the token counter (#737).
 */

import path from 'node:path'

import { isTestFile } from './behavior-change.mjs'

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
 * Reads the knowledge map (decision 0019, §5): a JSON list of `{ note, paths, exclude? }`, one per
 * note, giving the paths the note describes (and, optionally, paths another note takes out of them). Each entry becomes a path-scoped rule like a guideline's.
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
    const { note, paths, exclude } = entry ?? {}
    const valid =
      typeof note === 'string' &&
      note.endsWith('.md') &&
      Array.isArray(paths) &&
      paths.length > 0 &&
      paths.every((glob) => typeof glob === 'string' && glob !== '')
    const validExclude =
      exclude === undefined ||
      (Array.isArray(exclude) && exclude.every((glob) => typeof glob === 'string' && glob !== ''))
    if (!validExclude) {
      throw new Error(`${mapPath}: entry ${index + 1}: "exclude" must be a list of globs`)
    }
    if (!valid) {
      throw new Error(
        `${mapPath}: entry ${index + 1} needs a "note" (a .md path) and a non-empty "paths" list of globs`,
      )
    }
    return { source: note, paths, ...(exclude && { exclude }), origin: mapPath }
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

/**
 * Whether a knowledge-map entry describes `file`: it matches one of the entry's globs, none of its
 * `exclude` globs (a split note's own area, carved out of its parent's), and is not a test. The one definition the `PR Policy` check (`.github/scripts/knowledge-sync.mjs`) and the
 * Claude Code hook (`.claude/hooks/rules.mjs`) share, so they can't drift apart.
 */
export function describes({ paths, exclude = [] }, file) {
  const matches = (globs) => globs.some((glob) => globToRegExp(glob).test(file))
  return !isTestFile(file) && matches(paths) && !matches(exclude)
}

const dirOf = (file) => file.slice(0, file.lastIndexOf('/'))

/**
 * The globs a note's path-scoped rule lists. Claude Code's `paths` has no way to leave files out, so
 * an entry with `exclude` is written out as the folders and files it describes among `tracked`:
 * a folder as one `dir/**` when everything under it is described, `dir/*` when only its direct
 * files all are, else each file; folders with some described file are searched further.
 */
export function rulePaths(entry, tracked) {
  if (!entry.exclude) return entry.paths
  const matches = (globs, file) => globs.some((glob) => globToRegExp(glob).test(file))
  const described = new Set(
    tracked.filter((file) => matches(entry.paths, file) && !matches(entry.exclude, file)),
  )
  const globs = []
  const walk = (dir) => {
    const prefix = dir === '' ? '' : `${dir}/`
    const under = tracked.filter((file) => file.startsWith(prefix))
    const some = under.filter((file) => described.has(file))
    if (some.length === under.length && dir !== '') return globs.push(`${dir}/**`)
    const direct = under.filter((file) => dirOf(file) === dir)
    const directDescribed = direct.filter((file) => described.has(file))
    if (dir !== '' && direct.length > 0 && directDescribed.length === direct.length)
      globs.push(`${dir}/*`)
    else globs.push(...directDescribed)
    const subdirs = new Set(
      under
        .map((file) => file.slice(prefix.length).split('/'))
        .filter((p) => p.length > 1)
        .map((p) => p[0]),
    )
    for (const sub of [...subdirs].sort()) walk(`${prefix}${sub}`)
  }
  walk('')
  return globs
}
