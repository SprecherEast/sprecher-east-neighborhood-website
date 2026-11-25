/** Reading a knowledge note into the parts the checks look at. */
import { parseFrontmatter, splitFrontmatter } from '../frontmatter.mjs'

const COMMENT_OPEN = '<!--'
const COMMENT_CLOSE = '-->'

/**
 * What a reader sees of a line, and whether a comment that started on an earlier line is still
 * open. A comment, on one line or across several, is not text a reader sees, so not a purpose.
 */
function visibleText(line, open) {
  let text = line
  if (open) {
    const end = text.indexOf(COMMENT_CLOSE)
    if (end === -1) return { text: '', open: true }
    text = text.slice(end + COMMENT_CLOSE.length)
  }
  text = text.replace(/<!--[\s\S]*?-->/g, '')
  const start = text.indexOf(COMMENT_OPEN)
  return start === -1 ? { text, open: false } : { text: text.slice(0, start), open: true }
}

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
  let inComment = false
  lines.forEach((line, index) => {
    if (FENCE.test(line)) fenced = !fenced
    if (fenced) return
    const visible = visibleText(line, inComment)
    inComment = visible.open
    const heading = /^## (\S.*)/.exec(visible.text)
    if (heading) note.sections.push({ heading: heading[1].trim(), line: index + 1 })
    else if (note.sections.length === 0 && visible.text.trim() && !visible.text.startsWith('#'))
      note.purposeLines++
  })
  return note
}
