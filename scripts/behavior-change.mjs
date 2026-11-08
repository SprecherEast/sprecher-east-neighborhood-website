/**
 * Which changed files can alter behavior (decision 0019, section 6; #770). The one place the
 * classifier's rules live: the `PR Policy` knowledge check (`.github/scripts/knowledge-sync.mjs`),
 * the knowledge-map matching (`scripts/agent-context-maps.mjs`) and the Claude Code hook
 * (`.claude/hooks/rules.mjs`) all import it, so they can't drift.
 *
 * A file is one of:
 * - `doc`: Markdown anywhere, or anything under `docs/`. A change to one is a doc change.
 * - `test`: a test, spec, fixture or end-to-end file (`isTestFile`). Cannot change what a visitor,
 *   an editor or an agent gets.
 * - `exempt`: a lockfile, the generated Payload types, a package.json whose only change is a
 *   dependency patch version in a section in view, or a diff that touches only comments (any
 *   file type with a comment rule) or only formatting (JS, TS and CSS only).
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
/** Lockfiles are exempt whatever versions move: package.json declares the ranges, and its own changes are classified separately. */
const LOCKFILE = /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock)$/
const GENERATED = [/^src\/payload-types\.ts$/]

const matches = (patterns, path) => patterns.some((pattern) => pattern.test(path))

/** The one definition of a test file, used by the check, the hook and the knowledge map matching */
export const isTestFile = (path) => matches(TEST, path)

/** The kind a path alone decides, or null when only the diff can say. */
function kindOfPath(path) {
  if (isTestFile(path)) return 'test'
  if (matches(DOC, path)) return 'doc'
  if (LOCKFILE.test(path) || matches(GENERATED, path)) return 'exempt'
  return null
}

/** JS, TS and CSS: where a formatter's choices (spacing, quotes, semicolons) can't change behavior */
const FORMATTED = /\.(?:[cm]?[jt]sx?|css|scss)$/
/** How each file type writes a comment on a line of its own; other types have none */
const HASH =
  /(?:\.(?:ya?ml|sh|bash|toml|ini|env)|(?:^|\/)(?:Caddyfile|Dockerfile|\.env[^/]*|\.gitignore))$/

/**
 * One side of a hunk with its comment lines left out. In JS, TS and CSS a `//` line is a comment, a
 * line made only of `/* ... *\/` blocks is, and so are the lines from one that starts with `/*` and
 * does not close to the line that closes it. The block state starts only from such a line: a `*`
 * line whose opener is not in view is code, because `* 1000` can be arithmetic.
 */
function withoutComments(lines, filename) {
  const slash = FORMATTED.test(filename)
  const hash = HASH.test(filename)
  const kept = []
  let inBlock = false
  for (const line of lines) {
    const text = line.trim()
    if (slash) {
      if (inBlock) {
        const end = text.indexOf('*/')
        if (end === -1) continue
        inBlock = false
        if (text.slice(end + 2).trim() === '') continue
        kept.push(text.slice(end + 2).trim())
        continue
      }
      if (text.startsWith('//') || text === '*/') continue
      if (text.startsWith('/*')) {
        const rest = text.replace(/\/\*.*?\*\//g, '').trim()
        if (!text.includes('*/') || text.lastIndexOf('/*') > text.lastIndexOf('*/')) {
          inBlock = true
          continue
        }
        if (rest === '') continue
      }
    } else if (hash && text.startsWith('#')) continue
    kept.push(line)
  }
  return kept
}

const STRING = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`[^`]*`/g

/**
 * JS, TS and CSS code without a formatter's choices: spacing outside strings, the quote style of a
 * plain string, semicolons and trailing commas. A string's own text, spaces included, is kept.
 */
function formatted(lines) {
  const text = lines.map((line) => line.trim()).join('\n')
  let result = ''
  let last = 0
  const plain = (segment) =>
    segment
      .replace(/;/g, '')
      .replace(/\s+/g, ' ')
      .replace(/(?<![\w$]) | (?![\w$])/g, '')
      .replace(/,(?=[)\]}])/g, '')
  for (const match of text.matchAll(STRING)) {
    const literal = match[0]
    const inner = literal.slice(1, -1)
    const simple = literal[0] !== '`' && !/['"\\]/.test(inner)
    result += plain(text.slice(last, match.index)) + (simple ? `'${inner}'` : literal)
    last = match.index + literal.length
  }
  return result + plain(text.slice(last))
}

/** A patch as its hunks: the lines of the old side, of the new side, and all with their sign */
function hunksOf(patchText) {
  const hunks = []
  for (const line of patchText.split('\n')) {
    if (line.startsWith('@@')) hunks.push({ old: [], added: [], all: [] })
    else if (hunks.length === 0 || line.startsWith('\\')) continue
    else {
      const hunk = hunks[hunks.length - 1]
      hunk.all.push({ sign: line[0], text: line.slice(1) })
      if (line[0] !== '+') hunk.old.push(line.slice(1))
      if (line[0] !== '-') hunk.added.push(line.slice(1))
    }
  }
  return hunks
}

/**
 * True when, hunk by hunk, the old side (context and removed lines) and the new side (context and
 * added lines) are the same once comment lines are left out and, in JS, TS and CSS, a formatter's
 * choices are removed. Comparing in place means a reorder or a move shows. Elsewhere (YAML, shell,
 * Caddyfile, Dockerfile, JSON, anything else) the lines must match exactly, indentation and quotes
 * included, so only a comment line can change.
 */
function commentOrFormattingOnly(patchText, filename) {
  const compare = FORMATTED.test(filename)
    ? (lines) => formatted(withoutComments(lines, filename))
    : (lines) => withoutComments(lines, filename).join('\n')
  return hunksOf(patchText).every((hunk) => compare(hunk.old) === compare(hunk.added))
}

const SECTION = /^\s*"(dependencies|devDependencies|peerDependencies|optionalDependencies)":\s*\{/
const DEPENDENCY_LINE = /^\s*"((?:@[\w.-]+\/)?[\w.-]+)":\s*"[~^]?(\d+)\.(\d+)\.(\d+)[^"]*",?\s*$/

/**
 * True when every changed line of a package.json patch is a dependency version moving by a patch
 * level only: the same name, section, major and minor on both sides, with the section's opening
 * line in view in its hunk. A new or dropped dependency, a dependency moved between sections, a
 * minor or major bump, a script or the package's own `version` is not.
 */
export function isPatchBumpOnly(patchText) {
  const removed = new Map()
  const added = new Map()
  for (const hunk of hunksOf(patchText)) {
    let section = null
    for (const line of hunk.all) {
      const open = line.text.match(SECTION)
      if (open) section = open[1]
      if (line.sign === ' ') continue
      const match = line.text.match(DEPENDENCY_LINE)
      if (!match || !section) return false
      const key = `${section}/${match[1]}`
      if (key.endsWith('/version')) return false
      ;(line.sign === '-' ? removed : added).set(key, `${match[2]}.${match[3]}`)
    }
  }
  if (removed.size === 0 || removed.size !== added.size) return false
  return [...removed].every(([key, minor]) => added.get(key) === minor)
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
