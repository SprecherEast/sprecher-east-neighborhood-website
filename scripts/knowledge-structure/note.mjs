/** Reading a knowledge note into the parts the checks look at. */
import { parseFrontmatter, splitFrontmatter } from '../frontmatter.mjs'

/** A line that is only an HTML comment: not text a reader sees, so not a purpose. */
const COMMENT = /^\s*<!--.*-->\s*$/

export const FENCE = /^\s*(```|~~~)/

/**
 * A note as `{ hasFrontmatter, error, data, title, purposeLines, sections, body, bodyLines }`.
 * `data` keeps the fields in the order written. The body starts after the front matter, and
 * `sections` are its level 2 headings (with their line in the body), code fences skipped.
 */
export function parseNote(markdown) {
  const { text: raw, rest } = splitFrontmatter(markdown)
  const note = { hasFrontmatter: raw !== null, error: null, data: {}, body: rest }
  if (raw !== null) {
    try {
      const data = parseFrontmatter(markdown)
      if (typeof data !== 'object' || Array.isArray(data)) {
        note.error = 'the front matter is not a list of fields (key: value)'
      } else note.data = data
    } catch (error) {
      note.error = String(error.message).split('\n')[0]
    }
    const lineEnd = rest.indexOf('\n')
    note.body = lineEnd === -1 ? '' : rest.slice(lineEnd + 1)
  }
  const lines = note.body.replace(/^\n+/, '').replace(/\n$/, '').split('\n')
  note.bodyLines = lines.length
  note.title = /^# \S/.test(lines[0]) ? lines[0].slice(2).trim() : null
  note.sections = []
  note.purposeLines = 0
  let fenced = false
  lines.forEach((line, index) => {
    if (FENCE.test(line)) fenced = !fenced
    if (fenced) return
    const heading = /^## (\S.*)/.exec(line)
    if (heading) note.sections.push({ heading: heading[1].trim(), line: index + 1 })
    else if (
      note.sections.length === 0 &&
      line.trim() &&
      !line.startsWith('#') &&
      !COMMENT.test(line)
    )
      note.purposeLines++
  })
  return note
}
