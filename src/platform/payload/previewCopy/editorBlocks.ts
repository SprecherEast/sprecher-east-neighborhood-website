import type { Block } from 'payload'

type Feature = { sanitizedServerFeatureProps?: unknown } | undefined

/** The block-level blocks a rich-text field's editor lists, as written (a slug is a reference). */
export function editorBlocks(field: { editor?: unknown }): Block[] {
  const editor = field.editor as
    | { editorConfig?: { resolvedFeatureMap?: Map<string, Feature> } }
    | undefined
  const props = editor?.editorConfig?.resolvedFeatureMap?.get('blocks')?.sanitizedServerFeatureProps
  return (props as { blocks?: Block[] } | undefined)?.blocks ?? []
}
