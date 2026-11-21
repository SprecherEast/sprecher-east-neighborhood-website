import type { Block } from 'payload'

import { editorBlocks } from '../previewCopy/editorBlocks'
import type { FieldNode } from './configFields'

/**
 * The rich-text half of the config walk (#1395): what a Lexical editor stores, and which
 * collections it can point at. Each feature says what it stores through its own
 * `generateSchemaMap`, which is what Payload itself reads, so block references and the extra
 * fields of links and uploads come out resolved. Fails closed: a feature whose key is not on the
 * closed list below is reported, whatever its schema map says.
 */

type Feature = {
  generateSchemaMap?: (args: Record<string, unknown>) => Map<string, FieldNode> | undefined
  sanitizedServerFeatureProps?: unknown
}
type FeatureMap = Map<string, Feature | undefined>

/** Rich-text features that store nothing beyond plain text and formatting. */
const PLAIN_FEATURES = new Set([
  'align',
  'bold',
  'checklist',
  'heading',
  'horizontalRule',
  'indent',
  'inlineCode',
  'italic',
  'orderedList',
  'paragraph',
  'strikethrough',
  'subscript',
  'superscript',
  'toolbarFixed',
  'toolbarInline',
  'underline',
  'unorderedList',
  'blockquote',
])

/** Features whose schema maps and collection lists are read below. */
const READ_FEATURES = ['blocks', 'link', 'relationship', 'upload', 'experimental_table']

type EditorConfig = {
  collections: { slug: string; upload?: unknown }[]
  blocks?: Block[]
}

const isSlugList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')

const featureMap = (node: FieldNode): FeatureMap | null => {
  const editor = node.editor as { editorConfig?: { resolvedFeatureMap?: FeatureMap } } | undefined
  const map = editor?.editorConfig?.resolvedFeatureMap
  return map instanceof Map ? map : null
}

export { editorBlocks }

export function createEditorReader(config: EditorConfig, report: (message: string) => void) {
  const slugs = config.collections.map((c) => c.slug)
  const uploads = config.collections.filter((c) => c.upload).map((c) => c.slug)

  /** What a rich-text field's editor stores, from each known feature's own schema map. */
  const children = (node: FieldNode): FieldNode[] => {
    const features = featureMap(node)
    if (!features) {
      report(`rich-text field "${node.name}" has an editor the walker does not know`)
      return []
    }
    const found: FieldNode[] = []
    for (const [key, feature] of features) {
      if (!PLAIN_FEATURES.has(key) && !READ_FEATURES.includes(key)) {
        report(`unknown rich-text feature "${key}"`)
      } else if (typeof feature?.generateSchemaMap === 'function') {
        try {
          const schemas = feature.generateSchemaMap({
            config,
            field: node,
            i18n: {},
            props: feature.sanitizedServerFeatureProps,
            schemaMap: new Map(),
            schemaPath: node.name ?? '',
          })
          found.push(...(schemas ? [...schemas.values()] : []))
        } catch {
          report(`rich-text feature "${key}" could not be read`)
        }
      }
    }
    return found
  }

  /** Slugs from a feature's collection list, or every slug (less `disabled`) when it sets none. */
  const slugList = (key: string, value: unknown, all: string[], disabled?: unknown) => {
    const odd = [value, disabled].some((list) => list !== undefined && !isSlugList(list))
    if (odd) {
      report(`rich-text feature "${key}" lists collections in a shape the walker does not know`)
      return all
    }
    return (
      (value as string[] | undefined) ??
      all.filter((s) => !((disabled as string[]) ?? []).includes(s))
    )
  }

  /** What a rich-text editor can link, relate or embed. */
  const targets = (node: FieldNode): string[] => {
    const features = featureMap(node)
    const props = (key: string) =>
      (features?.get(key)?.sanitizedServerFeatureProps ?? {}) as Record<string, unknown>
    const found: string[] = []
    if (features?.has('link')) {
      const p = props('link')
      found.push(...slugList('link', p.enabledCollections, slugs, p.disabledCollections))
    }
    if (features?.has('relationship')) {
      found.push(...slugList('relationship', props('relationship').enabledCollectionSlugs, slugs))
    }
    if (features?.has('upload')) {
      const p = props('upload')
      found.push(...slugList('upload', p.enabledCollections, uploads, p.disabledCollections))
    }
    return found
  }

  return { children, targets }
}
