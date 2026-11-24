/** Finding the file paths a note names, and whether each exists. */
import path from 'node:path'

import { globToRegExp } from '../agent-context-maps.mjs'

const FENCE = /^\s*(```|~~~)/
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
      if (
        PATHLIKE.test(token) &&
        looks &&
        !token.startsWith('@/') &&
        !/^\/(?!docs|src)/.test(token)
      )
        references.push({ kind: 'code', token, line: index + 1 })
    }
    for (const [, target] of line.matchAll(/\]\(([^)\s]+)\)/g)) {
      const file = target.split('#')[0]
      if (file && !/^[a-z]+:/i.test(file) && extension.test(file))
        references.push({ kind: 'link', token: file, line: index + 1 })
    }
  })
  return references
}

const exists = (candidate, files) => {
  const clean = candidate.replace(/\/$/, '')
  if (clean.includes('*')) {
    const pattern = globToRegExp(clean)
    return files.some((file) => pattern.test(file))
  }
  return files.some((file) => file === clean || file.startsWith(`${clean}/`))
}

/** Whether a token names something in `files`: from the repo root, the note's folder or a schema root. */
export function resolves(token, { noteDir, files, schema }) {
  const clean = token.replace(/^\.\//, '').replace(/^\.\.\.\//, '')
  if (schema.paths.ignore.some((glob) => globToRegExp(glob).test(clean))) return true
  if (clean.startsWith('/')) return exists(clean.slice(1), files)
  if (clean.startsWith('../')) return exists(path.posix.normalize(`${noteDir}/${clean}`), files)
  const bases = [noteDir]
  for (let dir = noteDir; dir.includes('/'); ) {
    dir = path.posix.dirname(dir)
    bases.push(dir)
  }
  bases.push(...schema.paths.roots)
  const forms = [clean, ...schema.paths.extensions.map((extension) => `${clean}.${extension}`)]
  if (forms.some((form) => bases.some((base) => exists(base ? `${base}/${form}` : form, files))))
    return true
  // A note abbreviates: a folder's siblings by bare name, or the end of a long path. An ending
  // that exists in some file's path counts; the whole token must still match whole path parts.
  return exists(`**/${clean}`, files) || (clean.endsWith('/') && exists(`**/${clean}**`, files))
}
