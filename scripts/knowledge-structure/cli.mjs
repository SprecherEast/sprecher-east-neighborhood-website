#!/usr/bin/env node
/**
 * The knowledge structure check (#1460): holds every note to `docs/knowledge/note-schema.json`.
 *
 *   node scripts/knowledge-structure/cli.mjs                  check; exit 1 on a blocking finding
 *   node scripts/knowledge-structure/cli.mjs --write-index    rewrite the Notes lines of the index
 *   node scripts/knowledge-structure/cli.mjs --skeleton TYPE  print a new note's fields and sections
 *
 * Warnings (any rule the schema marks `warn`) are printed and counted
 * in the job summary, and never fail the run.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { KNOWLEDGE_MAP } from '../agent-context-maps.mjs'
import { checkKnowledge, mapNotes } from './check.mjs'
import { renderIndex } from './indexLines.mjs'
import { unknownKind } from './rules.mjs'

const SCHEMA = 'docs/knowledge/note-schema.json'
const INDEX = 'docs/knowledge/index.md'

/** A new note's text for a type: the fields as placeholders, then each section with its hint. */
export function skeleton(schema, type) {
  if (!Object.hasOwn(schema.noteTypes, type))
    throw new Error(
      `unknown type "${type}"; use one of: ${Object.keys(schema.noteTypes).join(', ')}`,
    )
  const fields = schema.fields.map((field) => {
    if (!Object.hasOwn(schema.kinds, field.kind)) throw unknownKind(field)
    const { placeholder } = schema.kinds[field.kind]
    return `${field.key}: ${placeholder === '$type' ? type : placeholder}`
  })
  const sections = schema.sections
    .filter((section) => section.appliesTo.includes(type))
    .map((section) => `## ${section.heading}\n\n<!-- ${section.presence}: ${section.hint} -->\n`)
  return `---\n${fields.join('\n')}\n---\n\n# TODO\n\nTODO: what this part is for, in one or two sentences.\n\n${sections.join('\n')}`
}

/** The text printed at the end, and written to the job summary: counts by severity and by rule. */
export function summarize(found) {
  const errors = found.filter((f) => f.severity === 'error')
  const warnings = found.filter((f) => f.severity === 'warning')
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
  const byRule = new Map()
  for (const f of found) byRule.set(f.rule, (byRule.get(f.rule) ?? 0) + 1)
  const rows = [...byRule].map(([rule, n]) => `- ${rule}: ${n}`)
  return [
    `Knowledge structure: ${plural(errors.length, 'error')}, ${plural(warnings.length, 'warning')}`,
    ...rows,
  ].join('\n')
}

/** The files of the repository: those git tracks or would, that still exist (never an empty entry). */
export function listFiles(root) {
  const out = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: Infinity,
    },
  )
  return out.split('\0').filter((file) => file && fs.existsSync(path.join(root, file)))
}

/**
 * Runs the command in `root` and returns the exit code: 1 when a finding blocks, else 0. `log`
 * prints a line; `env.GITHUB_STEP_SUMMARY` names a file the counts are appended to.
 */
export function execute({ argv, root, env = {}, log = console.log }) {
  const schema = JSON.parse(fs.readFileSync(path.join(root, SCHEMA), 'utf8'))
  const [arg, value] = argv
  if (arg === '--skeleton') {
    log(skeleton(schema, value))
    return 0
  }
  const mapJson = fs.readFileSync(path.join(root, KNOWLEDGE_MAP), 'utf8')
  const read = (file) => {
    const full = path.join(root, file)
    return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : undefined
  }
  if (arg === '--write-index') {
    const entries = mapNotes(schema, mapJson, read).filter((e) => e.name && e.summary)
    fs.writeFileSync(path.join(root, INDEX), renderIndex(read(INDEX), entries, INDEX))
    log(`Wrote the ${entries.length} note lines of ${INDEX}.`)
    return 0
  }
  const found = checkKnowledge({ schema, mapJson, files: listFiles(root), read })
  for (const f of found) log(`${f.severity} [${f.rule}] ${f.note}: ${f.message}`)
  const text = summarize(found)
  log(text)
  if (env.GITHUB_STEP_SUMMARY) fs.appendFileSync(env.GITHUB_STEP_SUMMARY, `${text}\n`)
  return found.some((f) => f.severity === 'error') ? 1 : 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
  process.exitCode = execute({ argv: process.argv.slice(2), root, env: process.env })
}
