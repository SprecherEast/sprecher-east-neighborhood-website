/** The index of notes, made from each note's name and summary so each line is written once. */
import path from 'node:path'

/** The index line for a note, with its link written from the index file's folder. */
export function indexLine({ path: notePath, name, summary }, indexPath) {
  const link = path.posix.relative(path.posix.dirname(indexPath), notePath)
  return `- [${name}](${link}): ${summary}`
}

const NOTES = '## Notes'

/** `indexText` with the lines under "## Notes" replaced by one line per entry; the rest is kept. */
export function renderIndex(indexText, entries, indexPath) {
  const lines = indexText.split('\n')
  const start = lines.indexOf(NOTES)
  if (start === -1) throw new Error(`${indexPath} has no "${NOTES}" section`)
  let end = lines.findIndex((line, i) => i > start && line.startsWith('## '))
  if (end === -1) end = lines.length
  const block = ['', ...entries.map((entry) => indexLine(entry, indexPath)), '']
  return [...lines.slice(0, start + 1), ...block, ...lines.slice(end)].join('\n')
}
