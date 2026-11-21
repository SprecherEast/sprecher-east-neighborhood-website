import type { Block } from 'payload'

/**
 * Walking the fields of a Payload config object, for the tests that read it with no database
 * (#140, #299, #1395).
 */

export type FieldNode = {
  name?: string
  type?: string
  hidden?: boolean
  relationTo?: string | string[]
  access?: { read?: unknown; create?: unknown; update?: unknown }
  fields?: FieldNode[]
  tabs?: FieldNode[]
  blocks?: FieldNode[]
  editor?: unknown
}

type FeatureMap = Map<string, { sanitizedServerFeatureProps?: unknown } | undefined>

/** What a rich-text field's editor says about one of its features, or undefined. */
function editorFeatureProps(field: { editor?: unknown }, feature: string): unknown {
  // The sanitized field carries the Lexical adapter, which knows its features
  const editor = field.editor as { editorConfig?: { resolvedFeatureMap?: FeatureMap } } | undefined
  return editor?.editorConfig?.resolvedFeatureMap?.get(feature)?.sanitizedServerFeatureProps
}

/** The block-level blocks a rich-text field's editor offers, or none. */
export function editorBlocks(field: { editor?: unknown }): Block[] {
  const props = editorFeatureProps(field, 'blocks') as { blocks?: Block[] } | undefined
  return props?.blocks ?? []
}

/** The inline blocks: the same `blocks` feature carries both lists. */
export function editorInlineBlocks(field: { editor?: unknown }): Block[] {
  const props = editorFeatureProps(field, 'blocks') as { inlineBlocks?: Block[] } | undefined
  return props?.inlineBlocks ?? []
}

/**
 * The collections a rich-text editor can point a stored link or relationship at. A link
 * feature with no `enabledCollections` allows every collection (Payload's default), so that
 * counts as all of `allSlugs`, less its `disabledCollections`.
 */
export function editorTargets(field: { editor?: unknown }, allSlugs: readonly string[]): string[] {
  const link = editorFeatureProps(field, 'link') as
    | { enabledCollections?: string[]; disabledCollections?: string[] }
    | undefined
  const relationship = editorFeatureProps(field, 'relationship') as
    | { enabledCollectionSlugs?: string[] }
    | undefined
  const linked = link
    ? (link.enabledCollections ??
      allSlugs.filter((slug) => !(link.disabledCollections ?? []).includes(slug)))
    : []
  return [...linked, ...(relationship?.enabledCollectionSlugs ?? [])]
}

/** The fields, tabs and blocks directly inside one node, and a rich-text field's editor blocks. */
export const fieldChildren = (node: FieldNode): FieldNode[] => [
  ...(node.fields ?? []),
  ...(node.tabs ?? []),
  ...(node.blocks ?? []),
  ...(node.type === 'richText'
    ? ([...editorBlocks(node), ...editorInlineBlocks(node)] as unknown as FieldNode[])
    : []),
]

/** Every field below `node`, however deeply nested. */
export const fieldDescendants = (node: FieldNode): FieldNode[] =>
  fieldChildren(node).flatMap((child) => [child, ...fieldDescendants(child)])

/**
 * The names an editor sees at the top of the document: layout-only containers (rows, unnamed
 * tabs, collapsibles) are looked through, a named group or tab counts once.
 */
export function topLevelFields(fields: FieldNode[]): FieldNode[] {
  return fields.flatMap((field) =>
    field.name ? [field] : topLevelFields([...(field.fields ?? []), ...(field.tabs ?? [])]),
  )
}
