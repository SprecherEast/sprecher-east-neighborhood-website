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

/** The blocks a rich-text field's editor offers (block and inline block), or none. */
export function editorBlocks(field: { editor?: unknown }): Block[] {
  const blocks = editorFeatureProps(field, 'blocks') as { blocks?: Block[] } | undefined
  const inline = editorFeatureProps(field, 'inlineBlocks') as { blocks?: Block[] } | undefined
  return [...(blocks?.blocks ?? []), ...(inline?.blocks ?? [])]
}

/** The collections a rich-text field's link feature may point at. */
export function editorLinkTargets(field: { editor?: unknown }): string[] {
  const link = editorFeatureProps(field, 'link') as { enabledCollections?: string[] } | undefined
  return link?.enabledCollections ?? []
}

/** The fields, tabs and blocks directly inside one node, and a rich-text field's editor blocks. */
export const fieldChildren = (node: FieldNode): FieldNode[] => [
  ...(node.fields ?? []),
  ...(node.tabs ?? []),
  ...(node.blocks ?? []),
  ...(node.type === 'richText' ? (editorBlocks(node) as unknown as FieldNode[]) : []),
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
