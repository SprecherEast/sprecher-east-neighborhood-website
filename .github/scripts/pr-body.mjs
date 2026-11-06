/**
 * Reads a pull request description. Used by the `PR Policy` workflow and by the knowledge-sync
 * check (#716), so the description is split into sections in one place.
 */

/**
 * The description without its HTML comments (the template's instructions). A comment that is
 * never closed hides the rest, as Markdown renders it. Removing one comment can join the halves
 * of another (`<!<!-- x -->-- y -->`), so it repeats until nothing changes and no `<!--` is left
 * for a reader to treat as hidden text.
 */
export function withoutComments(body) {
  let text = body ?? ''
  for (let previous = null; previous !== text; ) {
    previous = text
    text = text.replace(/<!--[\s\S]*?(?:-->|$)/g, '')
  }
  return text
}

/** The sections of a description: each `## Heading`, lower-cased, mapped to the text under it. */
export function sectionsOf(body) {
  const sections = {}
  for (const part of withoutComments(body)
    .split(/^##\s+/m)
    .slice(1)) {
    const newline = part.indexOf('\n')
    const title = (newline === -1 ? part : part.slice(0, newline)).trim().toLowerCase()
    sections[title] = newline === -1 ? '' : part.slice(newline + 1)
  }
  return sections
}
