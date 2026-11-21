import type { Block } from 'payload'

/** A rich-text feature as the editor resolves it: what it stores, and the schema it adds. */
export type Feature<Node = unknown> = {
  generateSchemaMap?: (args: Record<string, unknown>) => Map<string, Node> | undefined
  sanitizedServerFeatureProps?: unknown
}
export type FeatureMap<Node = unknown> = Map<string, Feature<Node> | undefined>

/** The block-level blocks a rich-text field's editor lists, as written (a slug is a reference). */
export function editorBlocks(field: { editor?: unknown }): Block[] {
  const editor = field.editor as { editorConfig?: { resolvedFeatureMap?: FeatureMap } } | undefined
  const props = editor?.editorConfig?.resolvedFeatureMap?.get('blocks')?.sanitizedServerFeatureProps
  return (props as { blocks?: Block[] } | undefined)?.blocks ?? []
}
