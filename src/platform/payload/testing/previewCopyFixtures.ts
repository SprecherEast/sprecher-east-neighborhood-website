/** Small synthetic configs and classifications for the preview copy gate tests (#1395). */

export const field = (name: string, extra: object = {}) => ({ name, type: 'text', ...extra })
export const open = () => true
export const configOf = (fields: unknown[], extra: object = {}, blocks: unknown[] = []) => ({
  collections: [{ slug: 'things', fields, access: { read: open }, ...extra }],
  globals: [],
  blocks,
})
export const entry = (
  keep: string[],
  clear: string[] = [],
  reads: 'all' | 'published' = 'all',
) => ({
  things: { copy: 'copied' as const, reason: 'A test collection.', keep, clear, reads },
})

/** A rich-text feature as Lexical resolves it: its props, and the sub-fields it says it stores. */
export const feature = (props: unknown = {}, schemas: Record<string, unknown> = {}) => ({
  sanitizedServerFeatureProps: props,
  generateSchemaMap: () => new Map(Object.entries(schemas)),
})
/** A feature that stores nothing beyond text, with no schema map (bold, headings, lists). */
export const plainFeature = () => ({ sanitizedServerFeatureProps: {} })

/** The one `blocks` feature carries both lists, as Lexical's does. */
export const blocksFeature = (blocks: { slug: string; fields: unknown[] }[], inline = []) =>
  feature(
    { blocks, inlineBlocks: inline },
    Object.fromEntries(
      [...blocks, ...inline].map((b: { slug: string; fields: unknown[] }) => [
        `lexical_blocks.${b.slug}.fields`,
        { fields: b.fields },
      ]),
    ),
  )

/** A rich-text field whose editor has exactly these features. */
export const lexical = (features: Record<string, unknown>, name = 'body') => ({
  name,
  type: 'richText',
  editor: { editorConfig: { resolvedFeatureMap: new Map(Object.entries(features)) } },
})

export const accountsOnly = {
  users: { copy: 'excluded' as const, reason: 'Accounts, never copied.' },
}
/** `things` with a second, excluded collection beside it. */
export const withUsers = (fields: unknown[], blocks: unknown[] = []) => ({
  ...configOf(fields, {}, blocks),
  collections: [
    ...configOf(fields).collections,
    { slug: 'users', fields: [], access: { read: () => false } },
  ],
})
