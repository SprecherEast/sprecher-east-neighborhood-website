/** The rules that read one note: its front matter, its headings, its size and its paths. */
import path from 'node:path'

import { parseNote } from './note.mjs'
import { existsExactly, pathReferences, resolves } from './paths.mjs'

const SEVERITY = { block: 'error', warn: 'warning' }

/** A finding, its severity taken from the schema's `rules` (a rule marked `warn` never fails). */
export const finding = (schema, rule, note, message) => ({
  rule,
  note,
  message,
  severity: SEVERITY[schema.rules[rule]],
})

const isLine = (value) => typeof value === 'string' && value.trim() !== '' && !value.includes('\n')
const isRelationship = (value) =>
  value !== null && typeof value === 'object' && isLine(value.type) && isLine(value.target)

/** The key of the field of a kind (the schema has one note type field). */
export const keyOfKind = (schema, kind) =>
  schema.fields.find((field) => field.key && field.kind === kind)?.key

function checkValue(add, schema, field, value, files) {
  const { key, kind, maxChars } = field
  if (kind === 'text') {
    if (!isLine(value) || (maxChars && value.length > maxChars))
      add(
        'NOTE-FIELD-VALUE',
        `${key} must be one line of text${maxChars ? `, at most ${maxChars} characters` : ''}`,
      )
  } else if (kind === 'noteType') {
    if (!Object.hasOwn(schema.noteTypes, value))
      add(
        'NOTE-TYPE',
        `${key} "${value}" is not one of ${Object.keys(schema.noteTypes).join(', ')}`,
      )
  } else if (kind === 'textList') {
    if (!(Array.isArray(value) && value.every(isLine)))
      add('NOTE-FIELD-VALUE', `${key} must be a list of one-line texts`)
  } else if (!Array.isArray(value) || !value.every(isRelationship)) {
    add('NOTE-FIELD-VALUE', `${key} must be a list of { type, target }`)
  } else {
    const { derived, hand } = schema.relationshipTypes
    for (const { type, target } of value) {
      if (Object.hasOwn(derived, type))
        add(
          'NOTE-RELATIONSHIP',
          `the scanner derives "${type}" (${derived[type]}); do not write it`,
        )
      else if (!Object.hasOwn(hand, type))
        add('NOTE-RELATIONSHIP', `relationship type "${type}" is not in relationshipTypes`)
      if (!existsExactly(target, files))
        add(
          'NOTE-RELATIONSHIP-TARGET',
          `relationship target ${target} is not a repository path that exists`,
        )
    }
  }
}

function fieldFindings(add, schema, note, files) {
  const keys = schema.fields.map((field) => field.key)
  const present = Object.keys(note.data)
  const missing = keys.filter((key) => !present.includes(key))
  const unknown = present.filter((key) => !keys.includes(key))
  if (missing.length > 0) add('NOTE-FIELDS', `missing field ${missing.join(', ')}`)
  if (unknown.length > 0) add('NOTE-FIELDS', `unknown field ${unknown.join(', ')}`)
  const wanted = keys.filter((key) => present.includes(key))
  const known = present.filter((key) => keys.includes(key))
  if (known.join() !== wanted.join()) {
    add('NOTE-FIELDS', `fields must be in this order: ${keys.join(', ')}`)
  }
  for (const field of schema.fields) {
    if (present.includes(field.key)) checkValue(add, schema, field, note.data[field.key], files)
  }
}

function sectionFindings(add, schema, note) {
  const type = note.data[keyOfKind(schema, 'noteType')]
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
  const type = note.data[keyOfKind(schema, 'noteType')]
  if (note.hasFrontmatter && !note.error && Object.hasOwn(schema.noteTypes, type))
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
