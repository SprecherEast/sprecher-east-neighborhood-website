#!/usr/bin/env node
/**
 * Keeps what an agent loads at the start of every session small (#144).
 *
 * The load map, a table in docs/guidelines/README.md, says which files make each reference load.
 * For every reference with globs, `agent-context-rules.mjs` writes a copy to .claude/rules/generated/:
 * the globs as `paths` frontmatter, then the reference's text. Claude Code loads such a rule only
 * when it reads or edits a matching file. The folder is build output, ignored by git and rebuilt
 * where it is needed (#1593): the session-start hook and `--write`.
 *
 * It also counts the tokens loaded at session start (CLAUDE.md, what it imports, and rules with no
 * `paths`) and fails over the budget (#737). Tokens, not lines, because line length varies too much.
 * The count is approximate: Claude's own tokenizer isn't published, so it uses OpenAI's `o200k_base`
 * through `js-tiktoken`, which runs offline. The lines are printed for information only.
 *
 *   node scripts/agent-context.mjs            check: the maps are sound, the budget holds
 *   node scripts/agent-context.mjs --write    build the copies, then check
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { Tiktoken } from 'js-tiktoken/lite'
import o200kBase from 'js-tiktoken/ranks/o200k_base'

import {
  KNOWLEDGE_MAP,
  LOAD_MAP,
  globToRegExp,
  parseKnowledgeMap,
  parseLoadMap,
} from './agent-context-maps.mjs'
import {
  GENERATED_DIR,
  buildRules,
  readFile,
  renderRule,
  rootLinks,
  ruleName,
  trackedFiles,
  writeRules,
} from './agent-context-rules.mjs'
import { frontmatterText } from './frontmatter.mjs'

// The parsers live in a module with no packages, so `PR Policy` can import them (#737)
export { KNOWLEDGE_MAP, LOAD_MAP, globToRegExp, parseKnowledgeMap, parseLoadMap }
export { GENERATED_DIR, renderRule, rootLinks, ruleName }

/**
 * The most tokens that session start may load (#737, #799). It keeps what every session pays for
 * small: current need plus modest headroom, enough for one short index line per knowledge note.
 * It is our own ceiling, not a vendor limit, and the owner may raise or lower it. It is the only
 * place the number lives; the check prints the live count.
 */
export const BUDGET_TOKENS = 6500

/** Whether a Markdown file starts with frontmatter that has a `paths` field. */
export function hasPaths(markdown) {
  const text = frontmatterText(markdown)
  return text !== null && /^paths:/m.test(text)
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

/**
 * All problems with the load maps and the budget, as messages. Writes the rules if asked. The rules
 * are build output (#1593): nothing compares them with a committed copy, and the budget counts the
 * rules the maps produce, whether or not they are on disk yet.
 */
export function run(root, { write = false, budgetTokens = BUDGET_TOKENS } = {}) {
  const tracked = trackedFiles(root)
  const { rules: built, problems } = write ? writeRules(root) : buildRules(root, tracked)
  const read = (file) => built.get(file) ?? readFile(root, file)

  const rules = tracked.filter((file) => file.startsWith('.claude/rules/') && file.endsWith('.md'))
  const loaded = startupFiles(read, [...new Set([...rules, ...built.keys()])])
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
    process.exit(1)
  }
}
