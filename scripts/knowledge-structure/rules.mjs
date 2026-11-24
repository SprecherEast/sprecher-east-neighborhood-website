/** The rules that read one note: its front matter, its headings, its size and its paths. */
import path from 'node:path'

import { parseNote } from './note.mjs'
import { pathReferences, resolves } from './paths.mjs'

const SEVERITY = { block: 'error', warn: 'warning' }

/** A finding, its severity taken from the schema's `rules` (a rule marked `warn` never fails). */
export const finding = (schema, rule, note, message) => ({
  rule,
  note,
  message,
  severity: SEVERITY[schema.rules[rule]],
})

const isText = (value) => typeof value === 'string' && value.trim() !== ''
const isRelationship = (value) =>
  value !== null && typeof value === 'object' && isText(value.type) && isText(value.target)

function fieldFindings(add, schema, note, files) {
  const keys = schema.fields.map((field) => field.key)
  const present = Object.keys(note.data)
  const missing = keys.filter((key) => !present.includes(key))
  const unknown = present.filter((key) => !keys.includes(key))
  if (missing.length > 0) add('NOTE-FIELDS', `missing field ${missing.join(', ')}`)
  if (unknown.length > 0) add('NOTE-FIELDS', `unknown field ${unknown.join(', ')}`)
  const known = present.filter((key) => keys.includes(key))
  const wanted = keys.filter((key) => known.includes(key))
  if (missing.length === 0 && unknown.length === 0 && known.join() !== wanted.join()) {
    add('NOTE-FIELDS', `fields must be in this order: ${keys.join(', ')}`)
  }
  const { name, type, summary, aliases, relationships } = note.data
  const limits = schema.limits
  if (present.includes('name') && (!isText(name) || name.length > limits.nameChars))
    add('NOTE-FIELD-VALUE', `name must be text of at most ${limits.nameChars} characters`)
  if (present.includes('summary')) {
    const bad = !isText(summary) || summary.length > limits.summaryChars || summary.includes('\n')
    if (bad)
      add(
        'NOTE-FIELD-VALUE',
        `summary must be one line of text, at most ${limits.summaryChars} characters`,
      )
  }
  if (present.includes('aliases') && !(Array.isArray(aliases) && aliases.every(isText)))
    add('NOTE-FIELD-VALUE', 'aliases must be a list of text')
  if (present.includes('type') && !(typeof type === 'string' && type in schema.noteTypes))
    add('NOTE-TYPE', `type "${type}" is not one of ${Object.keys(schema.noteTypes).join(', ')}`)
  if (!present.includes('relationships')) return
  if (!Array.isArray(relationships) || !relationships.every(isRelationship)) {
    add('NOTE-FIELD-VALUE', 'relationships must be a list of { type, target }')
    return
  }
  for (const { type: kind, target } of relationships) {
    const { derived, hand } = schema.relationshipTypes
    if (kind in derived)
      add('NOTE-RELATIONSHIP', `the scanner derives "${kind}" (${derived[kind]}); do not write it`)
    else if (!(kind in hand))
      add('NOTE-RELATIONSHIP', `relationship type "${kind}" is not in relationshipTypes`)
    if (
      !resolves(target, {
        noteDir: '',
        files,
        schema: { ...schema, paths: { ...schema.paths, roots: [''] } },
      })
    )
      add('NOTE-RELATIONSHIP-TARGET', `relationship target ${target} does not exist`)
  }
}

function sectionFindings(add, schema, note) {
  const type = note.data.type
  const allowed = schema.sections.filter((s) => s.appliesTo.includes(type))
  const order = allowed.map((s) => s.heading)
  const seen = []
  for (const { heading } of note.sections) {
    if (!order.includes(heading))
      add('NOTE-SECTIONS', `section "${heading}" is not one of: ${order.join(', ')}`)
    else if (seen.includes(heading)) add('NOTE-SECTIONS', `section "${heading}" appears twice`)
    else seen.push(heading)
  }
  const wanted = order.filter((heading) => seen.includes(heading))
  if (seen.join() !== wanted.join())
    add('NOTE-SECTIONS', `sections must be in this order: ${order.join(', ')}`)
  for (const section of allowed) {
    if (seen.includes(section.heading)) continue
    if (section.presence === 'required')
      add('NOTE-SECTIONS', `missing required section "${section.heading}"`)
    if (section.presence === 'expected')
      add('COVERAGE-SECTION', `section "${section.heading}" is not written yet`)
  }
}

/** All findings for one note (rules that need only the note and the file list). */
export function checkNote({ schema, path: notePath, text, files }) {
  const found = []
  const add = (rule, message) => found.push(finding(schema, rule, notePath, message))
  const note = parseNote(text)
  if (!note.hasFrontmatter)
    add('NOTE-FRONTMATTER', 'no front matter: a note starts with its fields')
  else if (note.error) add('NOTE-FRONTMATTER', `the front matter does not parse: ${note.error}`)
  else fieldFindings(add, schema, note, files)
  if (note.title === null) add('NOTE-TITLE', 'the body must start with a level 1 title')
  else if (note.purposeLines === 0)
    add('NOTE-TITLE', 'the title needs a purpose paragraph before the first section')
  if (note.hasFrontmatter && !note.error && note.data.type in schema.noteTypes)
    sectionFindings(add, schema, note)
  if (note.bodyLines > schema.limits.noteLines)
    add(
      'NOTE-CAP',
      `${note.bodyLines} lines below the front matter, over the limit of ${schema.limits.noteLines}`,
    )
  const noteDir = path.posix.dirname(notePath)
  for (const { kind, token, line } of pathReferences(note.body, schema)) {
    if (!resolves(token, { noteDir, files, schema }))
      add(
        'NOTE-PATH',
        `${kind === 'link' ? 'link' : 'path'} ${token} does not exist (body line ${line})`,
      )
  }
  return found
}
