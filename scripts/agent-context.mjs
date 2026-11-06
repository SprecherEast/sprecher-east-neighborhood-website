#!/usr/bin/env node
/**
 * Keeps what an agent loads at the start of every session small (#144).
 *
 * The load map, a table in docs/guidelines/README.md, says which files make each reference load.
 * For every reference with globs, this writes a copy to .claude/rules/generated/: the globs as
 * `paths` frontmatter, then the reference's text. Claude Code loads such a rule only when it reads
 * or edits a matching file. A copy rather than an import or a symlink, because an `@import` inside a
 * rule loads at session start whatever its `paths` say, and git on Windows checks symlinks out as
 * plain text unless symlinks are enabled (both tested on 2026-11-06, recorded on #144).
 *
 * It also counts the tokens loaded at session start (CLAUDE.md, what it imports, and rules with no
 * `paths`) and fails over the budget (#737). Tokens, not lines, because line length varies too much.
 * The count is approximate: Claude's own tokenizer isn't published, so it uses OpenAI's `o200k_base`
 * through `js-tiktoken`, which runs offline. The lines are printed for information only.
 *
 *   node scripts/agent-context.mjs            check: the copies are current, the budget holds
 *   node scripts/agent-context.mjs --write    rewrite the copies
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { Tiktoken } from 'js-tiktoken/lite'
import o200kBase from 'js-tiktoken/ranks/o200k_base'

/**
 * The most tokens that session start may load (#737). Measured at 5459 on 2026-11-06, plus about
 * 10% headroom. The owner may raise or lower it: it is the only place the number lives.
 */
export const BUDGET_TOKENS = 6000
export const LOAD_MAP = 'docs/guidelines/README.md'
export const KNOWLEDGE_MAP = 'docs/knowledge/map.json'
export const GENERATED_DIR = '.claude/rules/generated'
const LOAD_COLUMN = /loads by itself/i
/** What the load column says for a reference that has no globs on purpose. */
const NO_GLOBS = /^\s*(no\b|always\b)/i

/** Normalizes Windows line endings, so a checkout with `autocrlf` reads the same. */
const unix = (text) => text.replace(/\r\n/g, '\n')

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

/** Turns a relative Markdown link in `text`, written from `source`, into a repo-root link. */
export function rootLinks(text, source) {
  return text.replace(/\]\((?!https?:|mailto:|#|\/)([^)\s]+)\)/g, (_, target) => {
    const [file, hash] = target.split('#')
    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(source), file))
    return `](/${resolved}${hash === undefined ? '' : `#${hash}`})`
  })
}

/** The generated rule for one reference. */
export function renderRule({ source, paths, text }) {
  const frontmatter = ['---', 'paths:', ...paths.map((glob) => `  - '${glob}'`), '---'].join('\n')
  const notice =
    `<!-- Generated by scripts/agent-context.mjs from ${source}. Edit that file, then run ` +
    '`npm run agent-context -- --write`. -->'
  return `${frontmatter}\n\n${notice}\n\n${rootLinks(text, source).trimEnd()}\n`
}

/** The file name of the generated copy of `source`. */
export function ruleName(source) {
  return `${source.replace(/\.md$/, '').replaceAll('/', '--')}.md`
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

/** Whether a Markdown file starts with frontmatter that has a `paths` field. */
export function hasPaths(markdown) {
  const match = unix(markdown).match(/^---\n([\s\S]*?)\n---/)
  return Boolean(match && /^paths:/m.test(match[1]))
}

/** The `@path` imports in a memory file, skipping code spans and fenced blocks. */
export function importsOf(markdown) {
  const prose = markdown.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '')
  return [...prose.matchAll(/(?:^|\s)@([^\s)]+)/g)].map((match) => match[1])
}

let encoder
/** Approximate tokens in `text` (see the header: not Claude's own tokenizer). */
export function countTokens(text) {
  encoder ??= new Tiktoken(o200kBase)
  return encoder.encode(text, [], []).length
}

const lineCount = (text) => text.replace(/\n$/, '').split('\n').length

/**
 * Every file loaded at session start, with its line and token counts: CLAUDE.md, rules without `paths`,
 * what they import, and what rules with `paths` import, each file counted once. `read(file)`
 * returns its text or null.
 */
export function startupFiles(read, rules) {
  const seen = new Map()
  const visit = (file, depth) => {
    if (seen.has(file) || depth > 4) return
    const text = read(file)
    if (text === null) return
    seen.set(file, { lines: lineCount(text), tokens: countTokens(text) })
    for (const target of importsOf(text)) {
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file), target))
      visit(resolved, depth + 1)
    }
  }
  visit('CLAUDE.md', 0)
  visit('.claude/CLAUDE.md', 0)
  for (const rule of rules) {
    const text = read(rule)
    if (text === null) continue
    if (!hasPaths(text)) {
      visit(rule, 0)
      continue
    }
    // A scoped rule's own text waits for its paths, but its imports load at start
    for (const target of importsOf(text)) {
      visit(path.posix.normalize(path.posix.join(path.posix.dirname(rule), target)), 1)
    }
  }
  return [...seen].map(([file, counts]) => ({ file, ...counts }))
}

/** All problems with the generated rules and the budget, as messages. Writes the rules if asked. */
export function run(root, { write = false, budgetTokens = BUDGET_TOKENS } = {}) {
  const read = (file) => {
    const full = path.join(root, file)
    return fs.existsSync(full) && fs.statSync(full).isFile()
      ? unix(fs.readFileSync(full, 'utf8'))
      : null
  }
  const problems = []
  const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n')
  const guidelines = parseLoadMap(read(LOAD_MAP) ?? '').map((entry) => ({
    ...entry,
    origin: LOAD_MAP,
  }))
  if (guidelines.length === 0) problems.push(`${LOAD_MAP} has no load map with globs`)
  const notes = parseKnowledgeMap(read(KNOWLEDGE_MAP) ?? '[]')
  const entries = [...guidelines, ...notes]

  const expected = new Map()
  for (const entry of entries) {
    const text = read(entry.source)
    if (text === null) {
      problems.push(`${entry.origin} lists ${entry.source}, which doesn't exist`)
      continue
    }
    for (const glob of entry.paths) {
      const regexp = globToRegExp(glob)
      if (!tracked.some((file) => regexp.test(file))) {
        problems.push(`${entry.source}: \`${glob}\` matches no file in the repository`)
      }
    }
    expected.set(`${GENERATED_DIR}/${ruleName(entry.source)}`, renderRule({ ...entry, text }))
  }

  const dir = path.join(root, GENERATED_DIR)
  const present = fs.existsSync(dir) ? fs.readdirSync(dir).map((f) => `${GENERATED_DIR}/${f}`) : []
  if (write) {
    fs.mkdirSync(dir, { recursive: true })
    for (const file of present) if (!expected.has(file)) fs.rmSync(path.join(root, file))
    for (const [file, text] of expected) fs.writeFileSync(path.join(root, file), text)
  } else {
    for (const [file, text] of expected) {
      if (read(file) !== text) problems.push(`${file} is out of date`)
    }
    for (const file of present) if (!expected.has(file)) problems.push(`${file} is stale`)
  }

  const rules = tracked.filter((file) => file.startsWith('.claude/rules/') && file.endsWith('.md'))
  const loaded = startupFiles(read, write ? [...new Set([...rules, ...expected.keys()])] : rules)
  const total = loaded.reduce((sum, { tokens }) => sum + tokens, 0)
  const lines = loaded.reduce((sum, file) => sum + file.lines, 0)
  if (total > budgetTokens) {
    problems.push(
      `session start loads ${total} tokens (approximate), over the budget of ${budgetTokens}`,
    )
  }
  return { problems, loaded, total, lines }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const write = process.argv.includes('--write')
  const { problems, loaded, total, lines } = run(root, { write })
  const row = (tokens, lineCount, label) =>
    console.log(
      `${String(tokens).padStart(6)} tokens  ${String(lineCount).padStart(4)} lines  ${label}`,
    )
  for (const file of loaded) row(file.tokens, file.lines, file.file)
  row(total, lines, `loaded at session start (approximate; budget ${BUDGET_TOKENS} tokens)`)
  if (problems.length > 0) {
    for (const problem of problems) console.error(`error: ${problem}`)
    if (problems.some((p) => /out of date|stale/.test(p))) {
      console.error('Run `npm run agent-context -- --write` and commit the result.')
    }
    process.exit(1)
  }
}
