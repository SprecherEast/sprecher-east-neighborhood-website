/**
 * What the pages say about a function: the file it was written in, and what to call it. Pure.
 */

export const UNKNOWN_FILE = 'unknown'

/** Where files below `root` start: the root with one trailing slash, so `/repo-other` isn't `/repo`. */
export const rootPrefix = (root) => `${root.replace(/\/+$/, '')}/`

/**
 * Says where a function was written, from the script URL V8 records for it: a path under the
 * repo root as `src/...`, a package under `node_modules` by its name (Payload's own and the
 * plugins'), `unknown` for anything else. Never an absolute path, so the output is the same on
 * every machine.
 */
export function fileFromUrl(url, root) {
  if (!url) return UNKNOWN_FILE
  if (url.startsWith('node:')) return 'Node.js'
  const file = decodeURIComponent(url.replace(/^file:\/\//, '').replace(/\?.*$/, ''))
  const modules = file.lastIndexOf('/node_modules/')
  if (modules !== -1) {
    const parts = file.slice(modules + '/node_modules/'.length).split('/')
    return parts[0].startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
  }
  const prefix = rootPrefix(root)
  return file.startsWith(prefix) ? file.slice(prefix.length) : UNKNOWN_FILE
}

const ARROW_CONSTANT = /^(?:async\s*)?(?:\([^)]*\)|[\w$]+)\s*=>\s*\(?\s*(true|false)\s*\)?;?$/
const FUNCTION_CONSTANT =
  /^(?:async\s+)?function[^(]*\([^)]*\)\s*\{\s*return\s+(true|false)\s*;?\s*\}$/

/** `always allows` or `always denies` for a function that only returns `true` or `false`. */
function constantNote(fn) {
  const source = Function.prototype.toString.call(fn).trim()
  const value = (ARROW_CONSTANT.exec(source) ?? FUNCTION_CONSTANT.exec(source))?.[1]
  if (value === undefined) return ''
  return value === 'true' ? 'always allows' : 'always denies'
}

/**
 * The name to show for a function written under `key` (an operation or a hook phase). A function
 * with no name, or with only the name JavaScript gave it from that key (`read: () => true`), is
 * `inline`; one that only returns true or false also says what it does.
 */
export function functionLabel(fn, key) {
  const inline = !fn.name || fn.name === key
  return { name: inline ? 'inline' : fn.name, note: constantNote(fn) }
}

/** `inline (always allows)`, or just the name. */
export const labelText = ({ name, note }) => (note ? `${name} (${note})` : name)
