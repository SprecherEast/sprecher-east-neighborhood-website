import { countBlocksOfType, type LexicalNode } from '../lexicalTree'
import { FACT_TABS_BLOCK_TYPE } from './blockTypes'

/**
 * How an editorial block's props are written into, and read out of, Markdown (#640, #664): the
 * tags `<Chart … />` and `<FactTabs … />`. Payload's tag reader
 * is simple: it toggles on every `"` with no notion of an escape, counts `[`, `]`, `{` and `}`
 * without knowing about strings, and reads `\"` as an escaped quote but not `\\`. Text the editor
 * allows (a quote, a brace, a backslash) must therefore never appear raw in a tag, and what is
 * written here reads back unchanged.
 */

/** Text props in quotes can't hold these raw; they are written as entities and read back */
const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '"': '&quot;',
  '\\': '&#92;',
  '\n': '&#10;',
  '\r': '&#13;',
}
const READ_ENTITIES: Record<string, string> = Object.fromEntries(
  Object.entries(ENTITIES).map(([char, entity]) => [entity, char]),
)

/** Text as it is written inside a tag's quotes */
const writeText = (text: string) => text.replace(/[&<"\\\n\r]/g, (char) => ENTITIES[char])

/** The inverse: text from inside a tag's quotes, as written */
export const readText = (text: string) =>
  text.replace(/&(?:amp|lt|quot|#92|#10|#13);/g, (entity) => READ_ENTITIES[entity])

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
    const safe = body.replace(/\\[\s\S]|['<{}[\]]/g, (part) =>
      part === '\\"' ? escapeCode('"') : part.length === 1 ? escapeCode(part) : part,
    )
    return `"${safe}"`
  })

/** One prop as the tag writes it: text in quotes, a number or list in braces */
export const writeProp = (name: string, value: unknown): string =>
  typeof value === 'string' ? `${name}="${writeText(value)}"` : `${name}={${writeJson(value)}}`

/** The editorial blocks that are written as a Markdown tag: the tag's name and its block type */
const TAGS = [
  { name: 'Chart', blockType: 'chart' },
  { name: 'FactTabs', blockType: FACT_TABS_BLOCK_TYPE },
] as const
export type EditorialTagName = (typeof TAGS)[number]['name']

/** Why a tag was refused always starts like this, so a refusal can be traced to its tag */
export const refusalPrefix = (name: EditorialTagName) => `Invalid <${name}>:`

/**
 * For each tag, how many in the Markdown became neither a block nor a refusal. Payload's converter
 * throws when it can't find where a tag ends (a quote that is never closed, a missing `/>`), and
 * Lexical swallows that and drops the whole body, so the count is the only way to know. Only tags
 * that have some are listed.
 */
export function unreadTags(
  markdown: string,
  converted: { root?: unknown },
  refusals: readonly string[],
): { name: EditorialTagName; count: number }[] {
  return TAGS.map(({ name, blockType }) => {
    const written = markdown.match(new RegExp(`<${name}(?=\\s|>|$)`, 'gi'))?.length ?? 0
    const refused = refusals.filter((reason) => reason.startsWith(refusalPrefix(name))).length
    return {
      name,
      count: Math.max(
        0,
        written -
          (converted.root ? countBlocksOfType(converted.root as LexicalNode, blockType) : 0) -
          refused,
      ),
    }
  }).filter(({ count }) => count > 0)
}

/**
 * Payload's Markdown converter runs inside a Lexical editor, which logs an error an import throws
 * and carries on, so the caller would never hear why a tag was refused. While `run` converts,
 * the refusals of the editorial tags are collected here instead, and those tags are left as text:
 * the caller turns them into the answer. Conversion is synchronous, so one list at a time is safe.
 */
let collecting: string[] | null = null

export function collectTagRefusals<T>(run: () => T): { value: T; refusals: string[] } {
  const outer = collecting
  const refusals: string[] = []
  collecting = refusals
  try {
    return { value: run(), refusals }
  } finally {
    collecting = outer
  }
}

/**
 * `jsx.import` for a tag: the block's fields, or false (and a collected refusal) when `read`
 * throws because the tag is invalid. Outside a collection the error is thrown as is.
 */
export function importOrRefuse<T>(read: () => T): T | false {
  try {
    return read()
  } catch (error) {
    if (!collecting) throw error
    collecting.push(error instanceof Error ? error.message : String(error))
    return false
  }
}
