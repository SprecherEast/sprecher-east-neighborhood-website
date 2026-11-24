#!/usr/bin/env node
/**
 * The knowledge structure check (#1460): holds every note to `docs/knowledge/note-schema.json`.
 *
 *   node scripts/knowledge-structure/cli.mjs                  check; exit 1 on a blocking finding
 *   node scripts/knowledge-structure/cli.mjs --write-index    rewrite the Notes lines of the index
 *   node scripts/knowledge-structure/cli.mjs --skeleton TYPE  print a new note's fields and sections
 *
 * Warnings (the coverage rules, and any rule the schema still marks `warn`) are printed and counted
 * in the job summary, and never fail the run.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { KNOWLEDGE_MAP } from '../agent-context-maps.mjs'
import { checkKnowledge, mapNotes } from './check.mjs'
import { renderIndex } from './indexLines.mjs'

const SCHEMA = 'docs/knowledge/note-schema.json'
const INDEX = 'docs/knowledge/index.md'

/** A new note's text for a type: the fields as placeholders, then each section with its hint. */
export function skeleton(schema, type) {
  if (!(type in schema.noteTypes))
    throw new Error(
      `unknown type "${type}"; use one of: ${Object.keys(schema.noteTypes).join(', ')}`,
    )
  const fields = schema.fields.map(({ key }) => {
    if (key === 'type') return `type: ${type}`
    return key === 'aliases' || key === 'relationships' ? `${key}: []` : `${key}: TODO`
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

function listFiles() {
  const out = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    },
  )
  return out.split('\0').filter((file) => file && fs.existsSync(file))
}

function run() {
  process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'))
  const schema = JSON.parse(fs.readFileSync(SCHEMA, 'utf8'))
  const arg = process.argv[2]
  if (arg === '--skeleton') return console.log(skeleton(schema, process.argv[3]))
  const mapJson = fs.readFileSync(KNOWLEDGE_MAP, 'utf8')
  const read = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : undefined)
  if (arg === '--write-index') {
    const entries = mapNotes(mapJson, read).filter((e) => e.name && e.summary)
    fs.writeFileSync(INDEX, renderIndex(read(INDEX), entries, INDEX))
    return console.log(`Wrote the ${entries.length} note lines of ${INDEX}.`)
  }
  const found = checkKnowledge({ schema, mapJson, files: listFiles(), read })
  for (const f of found)
    console.log(
      `${f.severity === 'error' ? 'error' : 'warning'} [${f.rule}] ${f.note}: ${f.message}`,
    )
  const text = summarize(found)
  console.log(text)
  if (process.env.GITHUB_STEP_SUMMARY)
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`)
  if (found.some((f) => f.severity === 'error')) process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) run()
