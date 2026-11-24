/** Finding the file paths a note names, and whether each exists. */
import path from 'node:path'

import { globToRegExp } from '../agent-context-maps.mjs'
import { FENCE } from './note.mjs'

const PATHLIKE = /^[\w@.()[\]*/-]+$/

/** The paths in a note body: backticked ones that look like files or folders, and file links. */
export function pathReferences(body, schema) {
  const extension = new RegExp(`\\.(${schema.paths.extensions.join('|')})$`)
  const references = []
  let fenced = false
  body.split('\n').forEach((line, index) => {
    if (FENCE.test(line)) fenced = !fenced
    if (fenced) return
    for (const [, token] of line.matchAll(/`([^`]+)`/g)) {
      const inRepo = schema.paths.repoRoots.some((root) => token.startsWith(root))
      const looks = extension.test(token) || token.endsWith('/') || inRepo
      // `/x` in backticks is a route and `@/x` an alias; a link may start with `/` (the repository root)
      if (PATHLIKE.test(token) && looks && !/^(@\/|\/)/.test(token))
        references.push({ kind: 'code', token, line: index + 1 })
    }
    for (const [, target] of line.matchAll(/\]\(([^)\s]+)\)/g)) {
      const file = target.split('#')[0]
      if (!/^[a-z]+:/i.test(file) && extension.test(file))
        references.push({ kind: 'link', token: file, line: index + 1 })
    }
  })
  return references
}

/** Whether a repository-relative path (a file or a folder, no pattern) is in `files`, exactly. */
export function existsExactly(target, files) {
  const clean = target.replace(/\/$/, '')
  return files.some((file) => file === clean || file.startsWith(`${clean}/`))
}

const exists = (candidate, files) => {
  if (!candidate.includes('*')) return existsExactly(candidate, files)
  const pattern = globToRegExp(candidate)
  return files.some((file) => pattern.test(file))
}

/**
 * Whether a token names something in `files`. A link or a token starting with `/`, `./` or `../`
 * is read exactly (from the repository root, or from the note's folder). Any other token may be an
 * abbreviation, as the notes write them (a bare name after its folder, the end of a long path, no
 * extension), so it counts when some path ends with it, whole path parts only. A token that fails
 * both ways does not exist.
 */
export function resolves(token, { noteDir, files, schema }) {
  const clean = token.replace(/^\.\.\.\//, '')
  if (schema.paths.ignore.some((glob) => globToRegExp(glob).test(clean))) return true
  if (clean.startsWith('/')) return exists(clean.slice(1), files)
  if (/^\.\.?\//.test(clean)) return exists(path.posix.normalize(`${noteDir}/${clean}`), files)
  const forms = [clean, ...schema.paths.extensions.map((extension) => `${clean}.${extension}`)]
  return forms.some(
    (form) => exists(`**/${form}`, files) || exists(`**/${form.replace(/\/$/, '')}/**`, files),
  )
}
