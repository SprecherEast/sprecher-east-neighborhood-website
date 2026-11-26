/**
 * The product skeleton of the map (#1462): the site, its modules and shared areas, the feature
 * notes inside them, the notes themselves and the business rules the notes state. Everything comes
 * from the folder layout and the notes' front matter and sections. Pure.
 */
import path from 'node:path'

import { makeEdge, makeNode, nodeId } from './graph.mjs'

export const SITE_ID = nodeId('site', 'sprecher-east')
const SITE_PATH = 'docs/project.md'

const FOLDER_ROOTS = [
  { prefix: 'src/modules/', type: 'module' },
  { prefix: 'src/platform/', type: 'platform-area' },
]
const NOTE_AREA_TYPES = ['module', 'platform-area', 'feature']
const RULE_NAME_LIMIT = 70

/** A rule's short name: its text up to the first colon or full stop, cut at a word. */
function ruleName(text) {
  const head = text.split(/:\s|\.\s|\.$/)[0].trim()
  if (head.length <= RULE_NAME_LIMIT) return head
  const cut = head.slice(0, RULE_NAME_LIMIT).replace(/\s+\S*$/, '')
  return `${cut}…`
}

/** The module and platform-area folders the files show, as `{ id, type, folder, name }`, sorted. */
function areaFolders(files) {
  const found = new Map()
  for (const file of files) {
    for (const { prefix, type } of FOLDER_ROOTS) {
      if (!file.startsWith(prefix)) continue
      const name = file.slice(prefix.length).split('/')[0]
      if (file.slice(prefix.length).includes('/')) {
        found.set(`${type}:${name}`, {
          id: nodeId(type, name),
          type,
          folder: `${prefix}${name}`,
          name,
        })
      }
    }
  }
  return [...found.values()].sort((a, b) => (a.id < b.id ? -1 : 1))
}

/** The feature areas the notes declare: a note of type `feature` describes the folder it sits in. */
function featureAreas(notes) {
  return notes
    .filter((note) => note.type === 'feature')
    .map((note) => {
      const folder = path.posix.dirname(note.path)
      return {
        id: nodeId('feature', folder.replace(/^src\//, '')),
        type: 'feature',
        folder,
        name: folder,
      }
    })
}

function areaNode(area, note, top) {
  return makeNode({
    id: area.id,
    type: area.type,
    name: note?.name || path.posix.basename(area.folder),
    summary: note?.summary ?? '',
    path: note ? note.path : area.folder,
    module: top,
    aliases: note?.aliases ?? [],
    facts: [{ label: 'Folder', value: area.folder }],
    watchOuts: note?.watchOuts ?? [],
  })
}

/**
 * `{ nodes, edges, gaps, ownerOf }`. `ownerOf(file)` gives `{ id, top }`, the deepest area holding
 * a file and its module or shared area, or null. `mapEntries` are the entries of `map.json`.
 */
export function buildAreas({ files, notes, mapEntries }) {
  const noteByFolder = new Map(
    notes
      .filter((n) => NOTE_AREA_TYPES.includes(n.type))
      .map((n) => [path.posix.dirname(n.path), n]),
  )
  const features = featureAreas(notes)
  const areas = [...areaFolders(files), ...features]
  const byLength = [...areas].sort((a, b) => b.folder.length - a.folder.length)
  const parentOf = (area) =>
    byLength.find((other) => other !== area && area.folder.startsWith(`${other.folder}/`))
  const top = (area) => {
    const parent = parentOf(area)
    return parent ? top(parent) : area
  }
  const ownerOf = (file) => {
    const area = byLength.find((candidate) => file.startsWith(`${candidate.folder}/`))
    return area ? { id: area.id, top: top(area).id } : null
  }

  const nodes = [
    makeNode({
      id: SITE_ID,
      type: 'site',
      name: 'Sprecher East',
      summary:
        'The Sprecher East neighborhood website: its modules, shared code and how the work is done.',
      path: SITE_PATH,
    }),
  ]
  const edges = []
  const gaps = []

  for (const area of areas) {
    const note = noteByFolder.get(area.folder)
    nodes.push(areaNode(area, note, top(area).id))
    const parent = parentOf(area)
    edges.push(makeEdge({ from: parent ? parent.id : SITE_ID, to: area.id, type: 'contains' }))
    if (!note)
      gaps.push({
        kind: 'area-no-note',
        node: area.id,
        message: `${area.folder} has no knowledge note`,
      })
  }

  const mapped = new Map(mapEntries.map((entry) => [entry.source, entry]))
  for (const note of notes) {
    if (!NOTE_AREA_TYPES.includes(note.type)) {
      gaps.push({
        kind: 'note-type-unknown',
        node: nodeId('note', note.path),
        message: `${note.path} has type "${note.type}"`,
      })
    }
    const area = areas.find((a) => a.folder === path.posix.dirname(note.path))
    const owner = area ? top(area).id : SITE_ID
    const noteId = nodeId('note', note.path)
    if (note.names === 0) {
      gaps.push({
        kind: 'note-names-nothing',
        node: noteId,
        message: `${note.path} names no file or folder`,
      })
    }
    const entry = mapped.get(note.path)
    nodes.push(
      makeNode({
        id: noteId,
        type: 'note',
        name: note.name || note.title || note.path,
        summary: note.summary,
        path: note.path,
        module: owner,
        aliases: note.aliases,
        facts: [
          { label: 'Sections', value: note.sections.join(', ') },
          ...(entry ? [{ label: 'Describes', value: entry.paths.join(', ') }] : []),
        ],
      }),
    )
    if (area)
      edges.push(
        makeEdge({
          from: noteId,
          to: area.id,
          type: 'documents',
          via: ['docs/knowledge/map.json'],
        }),
      )
    const subject = area ? area.id : noteId
    note.rules.forEach((rule, index) => {
      const ruleId = nodeId('business-rule', `${note.path}#${index + 1}`)
      nodes.push(
        makeNode({
          id: ruleId,
          type: 'business-rule',
          name: ruleName(rule.text),
          summary: rule.text,
          path: rule.tests[0] ?? note.path,
          module: owner,
          links: rule.tests,
        }),
      )
      edges.push(makeEdge({ from: subject, to: ruleId, type: 'contains' }))
    })
    for (const relationship of note.relationships) {
      edges.push(
        makeEdge({
          from: subject,
          to: `path:${relationship.target}`,
          type: relationship.type,
          written: true,
        }),
      )
    }
    for (const link of note.links)
      edges.push(makeEdge({ from: noteId, to: `path:${link}`, type: 'mentions' }))
    for (const decision of note.decisions)
      edges.push(makeEdge({ from: subject, to: `path:${decision}`, type: 'decided-by' }))
  }
  return { nodes, edges, gaps, ownerOf }
}
