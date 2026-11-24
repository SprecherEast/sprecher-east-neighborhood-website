/** The knowledge structure check over a whole repository: every note, the map and the index. */
import { describes, globToRegExp, parseKnowledgeMap } from '../agent-context-maps.mjs'
import { isTestFile } from '../behavior-change.mjs'
import { renderIndex } from './indexLines.mjs'
import { parseNote } from './note.mjs'
import { pathReferences, resolves } from './paths.mjs'
import { checkNote, finding } from './rules.mjs'

const INDEX = 'docs/knowledge/index.md'

/** The note entries of the map, each with the name and summary its front matter gives. */
export function mapNotes(mapJson, read) {
  return parseKnowledgeMap(mapJson).map((entry) => {
    const text = read(entry.source)
    const data = text === undefined ? {} : parseNote(text).data
    return { entry, path: entry.source, name: data.name, summary: data.summary }
  })
}

function mapFindings(schema, entries, files, read, add) {
  const seen = new Set()
  for (const { entry, path } of entries) {
    if (seen.has(path)) add('MAP-NOTE', path, 'listed twice in docs/knowledge/map.json')
    seen.add(path)
    if (!files.includes(path)) {
      add('MAP-NOTE', path, 'listed in docs/knowledge/map.json but the file does not exist')
      continue
    }
    const text = read(path)
    const matched = files.some((file) => describes(entry, file) || entry.paths.includes(file))
    const names = pathReferences(parseNote(text).body, schema).some((ref) =>
      resolves(ref.token, { noteDir: path.slice(0, path.lastIndexOf('/')), files, schema }),
    )
    if (!matched) add('NOTE-NO-CODE', path, 'its map paths match no file')
    else if (!names) add('NOTE-NO-CODE', path, 'it names no code: no path in it exists')
  }
  const wanted = globToRegExp(schema.notes.discover)
  for (const file of files) {
    const folderEntry = schema.notes.folderEntries.includes(file)
    if (wanted.test(file) && !folderEntry && !seen.has(file))
      add('NOTE-ORPHAN', file, 'no map entry names this note')
  }
}

function indexFindings(entries, indexText, add) {
  const usable = entries.filter((e) => e.name && e.summary)
  let expected
  try {
    expected = renderIndex(indexText, usable, INDEX)
  } catch (error) {
    add('INDEX-DRIFT', INDEX, error.message)
    return
  }
  if (expected === indexText) return
  const have = new Set(indexText.split('\n'))
  const want = new Set(expected.split('\n'))
  for (const line of want) {
    if (!have.has(line))
      add('INDEX-DRIFT', INDEX, `missing or different line: ${line.slice(0, 90)}`)
  }
  for (const line of have) {
    if (
      line.startsWith('- [') &&
      !want.has(line) &&
      indexText.indexOf(line) < indexText.indexOf('## Reference')
    )
      add('INDEX-DRIFT', INDEX, `line not made from a note: ${line.slice(0, 90)}`)
  }
}

function coverageFinding(schema, entries, files, add) {
  const roots = schema.coverage.roots.map(globToRegExp)
  const ignored = schema.coverage.ignore.map(globToRegExp)
  const ext = new RegExp(`\\.(${schema.coverage.extensions.join('|')})$`)
  const loose = files.filter(
    (file) =>
      ext.test(file) &&
      roots.some((r) => r.test(file)) &&
      !isTestFile(file) &&
      !ignored.some((r) => r.test(file)) &&
      !entries.some(({ entry }) => describes(entry, file)),
  )
  if (loose.length === 0) return
  const byFolder = new Map()
  for (const file of loose) {
    const key = file.split('/').slice(0, 3).join('/')
    byFolder.set(key, (byFolder.get(key) ?? 0) + 1)
  }
  const top = [...byFolder].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`)
  add(
    'COVERAGE-CODE',
    'docs/knowledge/map.json',
    `${loose.length} source files have no note: ${top.join(', ')}`,
  )
}

/** Every finding for the repository: `files` are its paths, `read(path)` gives a file's text. */
export function checkKnowledge({ schema, mapJson, files, read }) {
  const entries = mapNotes(mapJson, read)
  const found = []
  const add = (rule, note, message) => found.push(finding(schema, rule, note, message))
  mapFindings(schema, entries, files, read, add)
  for (const { path } of entries) {
    if (files.includes(path)) found.push(...checkNote({ schema, path, text: read(path), files }))
  }
  indexFindings(entries, read(INDEX) ?? '', add)
  coverageFinding(schema, entries, files, add)
  return found
}
