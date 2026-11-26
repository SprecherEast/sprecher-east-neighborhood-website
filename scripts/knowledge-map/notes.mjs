/**
 * Reading one knowledge note into what the map needs (#1462): its fields, its purpose, its rules
 * with the tests that protect them, its watch-outs (the Known gaps section) and the files it links.
 * Pure: the text and the list of repository files are given.
 */
import path from 'node:path'

import { parseNote } from '../knowledge-structure/note.mjs'
import { pathReferences } from '../knowledge-structure/paths.mjs'

const COMMENT = /<!--[\s\S]*?-->/g
const NONE = /^none\.?$/i
const TESTISH = /\.test\.[a-z]+$/

const clean = (text) => text.replace(/\s+/g, ' ').trim()

/** The items of a section: list items (a wrapped line joins its item), or a paragraph as one item. "None" is no item. */
export function bulletsOf(text) {
  const items = []
  let prose = []
  for (const line of text.replace(COMMENT, '').split('\n')) {
    if (/^[-*] /.test(line)) items.push(line.slice(2))
    else if (!line.trim()) prose = []
    else if (items.length > 0 && /^\s/.test(line)) items[items.length - 1] += ` ${line.trim()}`
    else {
      prose.push(line.trim())
      if (prose.length === 1) items.push(line.trim())
      else items[items.length - 1] = prose.join(' ')
    }
  }
  return items.map(clean).filter((item) => item && !NONE.test(item))
}

/** The text of each level 2 section of a parsed note, by heading. */
function sectionTexts(note) {
  const lines = note.body.replace(/^\n+/, '').replace(/\n$/, '').split('\n')
  return Object.fromEntries(
    note.sections.map((section, index) => {
      const end = note.sections[index + 1] ? note.sections[index + 1].line - 1 : lines.length
      return [section.heading, lines.slice(section.line, end).join('\n')]
    }),
  )
}

/**
 * A token a note writes (a path from the note's folder, or the end of a path) as the repository
 * path of the one file it names, or null when none or more than one file fits.
 */
export function resolveToken(token, noteDir, files) {
  const exact = path.posix.normalize(`${noteDir}/${token}`)
  if (files.includes(exact)) return exact
  if (files.includes(token)) return token
  const ends = files.filter((file) => file.endsWith(`/${token}`))
  return ends.length === 1 ? ends[0] : null
}

/** The repository files a text links to with Markdown links, sorted, once each; outside links and anchors dropped. */
export function linkedPaths(markdown, notePath, files = null) {
  const found = new Set()
  const body = parseNote(markdown).body
  for (const ref of pathReferences(body, { paths: SCHEMA_PATHS })) {
    if (ref.kind !== 'link') continue
    const target = ref.token.startsWith('/')
      ? ref.token.slice(1)
      : path.posix.normalize(`${path.posix.dirname(notePath)}/${ref.token}`)
    if (!files || files.includes(target)) found.add(target)
  }
  return [...found].sort()
}

// `pathReferences` needs the extensions to tell a file link from a web link; links to any file count here
const SCHEMA_PATHS = {
  extensions: ['md', 'ts', 'tsx', 'mjs', 'json', 'yml', 'yaml', 'sh', 'css'],
  repoRoots: [],
}

/**
 * A note as the map needs it: `{ path, name, type, summary, aliases, relationships, title,
 * sections, rules, watchOuts, decisions, links, names }`; `names` counts the paths the text names. A field a note lacks is empty, never missing.
 */
export function readNote(notePath, text, { schema, files }) {
  const note = parseNote(text)
  const data = note.data ?? {}
  const texts = sectionTexts(note)
  const noteDir = path.posix.dirname(notePath)
  const rules = bulletsOf(texts['Rules and the tests that protect them'] ?? '').map((item) => ({
    text: item,
    tests: [
      ...new Set(
        [...item.matchAll(/`([^`]+)`/g)]
          .map(([, token]) => token)
          .filter((token) => TESTISH.test(token))
          .map((token) => resolveToken(token, noteDir, files))
          .filter(Boolean),
      ),
    ],
  }))
  const links = linkedPaths(text, notePath, files)
  const decisionLinks = linkedPaths(texts.Decisions ?? '', notePath, files)
  const field = (key) =>
    typeof data[schema.index[key] ?? key] === 'string' ? data[schema.index[key] ?? key] : ''
  return {
    path: notePath,
    name: field('label'),
    type: typeof data.type === 'string' ? data.type : '',
    summary: field('text'),
    aliases: Array.isArray(data.aliases) ? data.aliases.filter((a) => typeof a === 'string') : [],
    relationships: Array.isArray(data.relationships) ? data.relationships : [],
    title: note.title ?? '',
    sections: note.sections.map((section) => section.heading),
    rules,
    watchOuts: bulletsOf(texts['Known gaps'] ?? ''),
    decisions: decisionLinks.filter((link) => link.includes('/decisions/')),
    links,
    names: pathReferences(note.body, schema).length,
  }
}
