/**
 * Which changed files can alter behavior (decision 0019, section 6; #770). The one place the
 * classifier's rules live: the `PR Policy` knowledge check (`.github/scripts/knowledge-sync.mjs`)
 * and the Claude Code hook (`.claude/hooks/rules.mjs`) both import it, so they can't drift.
 *
 * A file is one of:
 * - `doc`: Markdown anywhere, or anything under `docs/`. A change to one satisfies the check.
 * - `test`: a test, spec, fixture or end-to-end file. Cannot change what a visitor, an editor or
 *   an agent gets.
 * - `exempt`: a lockfile, the generated Payload types, a package.json whose only change is
 *   dependency patch versions, or a diff that touches only comments and formatting.
 * - `behavior`: everything else. The default, so a new kind of file is checked until a rule here
 *   says it need not be. When the diff is missing (binary, very large) or the change is a move,
 *   a file is behavior too: when the classifier cannot tell, it asks for the declaration.
 *
 * Input is a file of GitHub's `pulls.listFiles`: `{ filename, previous_filename?, status, patch? }`.
 */

/** Paths that can't change behavior, checked against the path alone. */
const DOC = [/\.mdx?$/i, /^docs\//]
const TEST = [
  /\.(test|spec)\.[^/]+$/,
  /(^|\/)__(tests|mocks|fixtures)__\//,
  /^tests?\//,
  /(^|\/)e2e\//,
]
const LOCKFILE = /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock)$/
const GENERATED = [/^src\/payload-types\.ts$/]

const matches = (patterns, path) => patterns.some((pattern) => pattern.test(path))

/** The kind a path alone decides, or null when only the diff can say. */
function kindOfPath(path) {
  if (matches(TEST, path)) return 'test'
  if (matches(DOC, path)) return 'doc'
  if (LOCKFILE.test(path) || matches(GENERATED, path)) return 'exempt'
  return null
}

/** How a file type writes a comment on a line of its own */
const SLASH = /\.(?:[cm]?[jt]sx?|css|scss|json5)$/
const HASH =
  /(?:\.(?:ya?ml|sh|bash|toml|ini|env)|(?:^|\/)(?:Caddyfile|Dockerfile|\.env[^/]*|\.gitignore))$/

/** Whether a trimmed line is only a comment. `block` is true when the patch shows a `/*` opening. */
function isCommentLine(line, filename, block) {
  if (SLASH.test(filename)) {
    if (/^(?:\/\/|\/\*|\*\/|\{\s*\/\*)/.test(line)) return true
    // A `* text` line is a comment only when a block comment is in view: `* 1000` can be code
    return block && /^\*(?:\s|$)/.test(line)
  }
  return HASH.test(filename) && line.startsWith('#')
}

/** The code on lines the patch removed (`-`) or added (`+`), comment and blank lines left out */
function codeLines(patchText, sign, filename, block) {
  return patchText
    .split('\n')
    .filter((line) => line.startsWith(sign))
    .map((line) => line.slice(1).trim())
    .filter((line) => line !== '' && !isCommentLine(line, filename, block))
}

/** Code with the choices a formatter makes taken out: spacing, quotes, semicolons, trailing commas */
const flatten = (lines) =>
  lines
    .join('\n')
    .replace(/\s+/g, '')
    .replace(/"/g, "'")
    .replace(/;/g, '')
    .replace(/,(?=[)\]}])/g, '')

/** True when removing the comment lines and the formatting leaves the same code on both sides */
function commentOrFormattingOnly(patchText, filename) {
  const block = /\/\*/.test(patchText)
  const removed = flatten(codeLines(patchText, '-', filename, block))
  const added = flatten(codeLines(patchText, '+', filename, block))
  return removed === added
}

const DEPENDENCY_LINE =
  /^[-+]\s*"((?:@[\w.-]+\/)?[\w.-]+)":\s*"[~^]?(\d+)\.(\d+)\.(\d+)[^"]*",?\s*$/

/**
 * True when every changed line of a package.json patch is a dependency version moving by a patch
 * level only: the same name, major and minor on both sides. A new or dropped dependency, a minor
 * or major bump, a script or the package's own `version` is not.
 */
export function isPatchBumpOnly(patchText) {
  const lines = patchText.split('\n').filter((line) => /^[-+]/.test(line))
  if (lines.length === 0) return false
  const removed = new Map()
  const added = new Map()
  for (const line of lines) {
    const match = line.match(DEPENDENCY_LINE)
    if (!match || match[1] === 'version') return false
    ;(line[0] === '-' ? removed : added).set(match[1], `${match[2]}.${match[3]}`)
  }
  if (removed.size !== added.size) return false
  return [...removed].every(([name, minor]) => added.get(name) === minor)
}

/**
 * What a changed file is: `{ kind, reason }`, kind being `doc`, `test`, `exempt` or `behavior`.
 * @param {{ filename: string, previous_filename?: string, status?: string, patch?: string }} file
 */
export function classifyFile({ filename, previous_filename: previous, status, patch }) {
  const kind = kindOfPath(filename)
  const previousKind = previous ? kindOfPath(previous) : kind
  if (kind && previousKind === kind) return { kind, reason: 'path' }
  if (kind === 'test' || kind === 'doc') {
    // A doc or test name over a move out of code (or back): the code moved
    return { kind: 'behavior', reason: 'a move between code and a doc or test path' }
  }
  if (status === 'renamed') return { kind: 'behavior', reason: 'code moved' }
  if (patch === undefined || patch === '') return { kind: 'behavior', reason: 'no diff to read' }
  if (filename.split('/').pop() === 'package.json') {
    return isPatchBumpOnly(patch)
      ? { kind: 'exempt', reason: 'dependency patch versions only' }
      : { kind: 'behavior', reason: 'package.json changed beyond patch versions' }
  }
  if (commentOrFormattingOnly(patch, filename)) {
    return { kind: 'exempt', reason: 'comments or formatting only' }
  }
  return { kind: 'behavior', reason: 'code changed' }
}

/** A pull request's files split into the ones that can change behavior and the docs among them */
export function classifyChanges(files) {
  const behavior = []
  const docs = []
  for (const file of files) {
    const { kind } = classifyFile(file)
    if (kind === 'behavior') behavior.push(file)
    else if (kind === 'doc') docs.push(file)
  }
  return { behavior, docs }
}
