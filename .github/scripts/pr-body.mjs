/**
 * Reads a pull request description: the one parser for the `PR Policy` and `Issue Fix Summary`
 * workflows and the knowledge-sync check (#716), so comments, sections and linked issues are
 * read in one place.
 */

/**
 * The description without its HTML comments (the template's instructions). A comment that is
 * never closed hides the rest, as Markdown renders it. Removing one comment can join the halves
 * of another (`<!<!-- x -->-- y -->`), so it repeats until nothing changes and no `<!--` is left
 * for a reader to treat as hidden text.
 */
export function withoutComments(body) {
  let text = (body ?? '').replace(/\r\n?/g, '\n')
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

/**
 * The issues a description links: `closes` for "Closes/Fixes/Resolves #N", `partOf` for
 * "Part of #N" (an issue that also closes isn't listed again). Links inside comments don't count.
 */
export function linkedIssues(body) {
  const text = withoutComments(body)
  const numbers = (re) => [...new Set([...text.matchAll(re)].map((match) => Number(match[1])))]
  const closes = numbers(/\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?):?\s+#(\d+)\b/gi)
  const partOf = numbers(/\bpart of:?\s+#(\d+)\b/gi).filter((number) => !closes.includes(number))
  return { closes, partOf }
}
