/** The index of notes, made from each note's name and summary so each line is written once. */
import path from 'node:path'

/** The index line for a note, with its link written from the index file's folder. */
export function indexLine({ path: notePath, name, summary }, indexPath) {
  const link = path.posix.relative(path.posix.dirname(indexPath), notePath)
  return `- [${name}](${link}): ${summary}`
}

const NOTES = '## Notes'

/** Where the Notes section sits in the index's lines: after its heading, up to the next one. */
function notesRegion(lines, indexPath) {
  const start = lines.indexOf(NOTES)
  if (start === -1) throw new Error(`${indexPath} has no "${NOTES}" section`)
  let end = lines.findIndex((line, i) => i > start && line.startsWith('## '))
  if (end === -1) end = lines.length
  return { start: start + 1, end }
}

/** The non-blank lines under "## Notes". */
export function noteLinesOf(indexText, indexPath) {
  const lines = indexText.split('\n')
  const { start, end } = notesRegion(lines, indexPath)
  return lines.slice(start, end).filter((line) => line.trim() !== '')
}

/** `indexText` with the lines under "## Notes" replaced by one line per entry; the rest is kept. */
export function renderIndex(indexText, entries, indexPath) {
  const lines = indexText.split('\n')
  const { start, end } = notesRegion(lines, indexPath)
  const block = ['', ...entries.map((entry) => indexLine(entry, indexPath)), '']
  return [...lines.slice(0, start), ...block, ...lines.slice(end)].join('\n')
}
