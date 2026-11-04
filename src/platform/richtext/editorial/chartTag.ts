/**
 * How a chart's props are written into, and read out of, Markdown (#640). Payload's tag reader
 * is simple: it toggles on every `"` with no notion of an escape, counts `[`, `]`, `{` and `}`
 * without knowing about strings, and reads `\"` as an escaped quote but not `\\`. Text the editor
 * allows (a quote, a brace, a backslash) must therefore never appear raw in a tag, and what is
 * written here reads back unchanged.
 */

/** Text props in quotes can't hold these raw; they are written as entities and read back */
const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '"': '&quot;',
  '\\': '&#92;',
  '\n': '&#10;',
  '\r': '&#13;',
}
const READ_ENTITIES: Record<string, string> = Object.fromEntries(
  Object.entries(ENTITIES).map(([char, entity]) => [entity, char]),
)

/** Text as it is written inside a tag's quotes */
const writeText = (text: string) => text.replace(/[&"\\\n\r]/g, (char) => ENTITIES[char])

/** The inverse: text from inside a tag's quotes, as written */
export const readText = (text: string) =>
  text.replace(/&(?:amp|quot|#92|#10|#13);/g, (entity) => READ_ENTITIES[entity])

/**
 * A list or object as JSON, with every character the tag reader mishandles inside a string
 * written as a `\u` escape, which JSON reads back as the same character: `"`, `'`, braces and
 * brackets. Payload's own `propsToJSXString` escapes an apostrophe as `\\'`, which grows by a
 * backslash each time the tag is saved and loaded.
 */
const escapeCode = (char: string) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`
const writeJson = (value: unknown) =>
  JSON.stringify(value).replace(/"((?:[^"\\]|\\.)*)"/g, (_literal, body: string) => {
    // Escape pairs are read whole, so `\\` followed by a quote is not taken for `\"`
    const safe = body.replace(/\\[\s\S]|['{}[\]]/g, (part) =>
      part === '\\"' ? escapeCode('"') : part.length === 1 ? escapeCode(part) : part,
    )
    return `"${safe}"`
  })

/** One prop as the tag writes it: text in quotes, a number or list in braces */
export const writeProp = (name: string, value: unknown): string =>
  typeof value === 'string' ? `${name}="${writeText(value)}"` : `${name}={${writeJson(value)}}`

const TAG_START = /<Chart(?=\s|>|$)/gi
const hasChartBlock = (node: unknown): number => {
  if (!node || typeof node !== 'object') return 0
  const { fields, children } = node as { fields?: { blockType?: unknown }; children?: unknown }
  const own = fields?.blockType === 'chart' ? 1 : 0
  return own + (Array.isArray(children) ? children.reduce((n, c) => n + hasChartBlock(c), 0) : 0)
}

/**
 * How many `<Chart` tags in the Markdown became neither a chart block nor a refusal. Payload's
 * converter throws when it can't find where a tag ends (a quote that is never closed, a missing
 * `/>`), and Lexical swallows that and drops the whole body, so the count is the only way to know.
 */
export function unreadChartTags(
  markdown: string,
  converted: { root?: unknown },
  refusals: readonly string[],
): number {
  const written = markdown.match(TAG_START)?.length ?? 0
  return Math.max(0, written - hasChartBlock(converted.root) - refusals.length)
}
