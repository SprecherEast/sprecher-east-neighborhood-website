import type { Block } from 'payload'

/**
 * Walking the fields of a Payload config object, for the tests that read it with no database
 * (#140, #299, #1395).
 *
 * It fails closed: a field type, editor or editor feature it does not recognise is reported in
 * `problems` and never skipped, so something new cannot hide a field from a test that trusts the
 * walk. Each Lexical feature says what it stores through its own `generateSchemaMap`, which is
 * what Payload itself reads, so block references, link and upload fields come out resolved.
 */

export type FieldNode = {
  name?: string
  type?: string
  hidden?: boolean
  relationTo?: string | string[]
  /** A join field's collection: virtual, but still something a kept field points at. */
  collection?: string | string[]
  access?: { read?: unknown; create?: unknown; update?: unknown }
  fields?: FieldNode[]
  tabs?: FieldNode[]
  blocks?: (FieldNode | string)[]
  blockReferences?: (FieldNode | string)[]
  editor?: unknown
}

type Feature = {
  generateSchemaMap?: (args: Record<string, unknown>) => Map<string, FieldNode> | undefined
  sanitizedServerFeatureProps?: unknown
}
type FeatureMap = Map<string, Feature | undefined>

/** Every field type Payload offers; any other is unknown to the walker. */
const KNOWN_TYPES = new Set([
  'array',
  'blocks',
  'checkbox',
  'code',
  'collapsible',
  'date',
  'email',
  'group',
  'join',
  'json',
  'number',
  'point',
  'radio',
  'relationship',
  'richText',
  'row',
  'select',
  'tabs',
  'text',
  'textarea',
  'ui',
  'upload',
])
/** Layout-only containers: no name, so their children sit at the level above. */
const LAYOUT_TYPES = new Set(['row', 'collapsible', 'tabs', 'ui'])
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

type WalkConfig = {
  collections: { slug: string; upload?: unknown }[]
  blocks?: Block[]
}

const isSlugList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')

/** The block-level blocks a rich-text field's editor lists, as written (a slug is a reference). */
export function editorBlocks(field: { editor?: unknown }): Block[] {
  const editor = field.editor as { editorConfig?: { resolvedFeatureMap?: FeatureMap } } | undefined
  const props = editor?.editorConfig?.resolvedFeatureMap?.get('blocks')?.sanitizedServerFeatureProps
  return (props as { blocks?: Block[] } | undefined)?.blocks ?? []
}

export function createFieldWalker(config: WalkConfig) {
  const problems: string[] = []
  const report = (message: string) => {
    if (!problems.includes(message)) problems.push(message)
  }
  const slugs = config.collections.map((c) => c.slug)
  const uploads = config.collections.filter((c) => c.upload).map((c) => c.slug)

  const featureMap = (node: FieldNode): FeatureMap | null => {
    const editor = node.editor as { editorConfig?: { resolvedFeatureMap?: FeatureMap } } | undefined
    const map = editor?.editorConfig?.resolvedFeatureMap
    return map instanceof Map ? map : null
  }

  const resolveBlock = (block: FieldNode | string): FieldNode[] => {
    if (typeof block !== 'string') return [block]
    const found = config.blocks?.find((b) => b.slug === block)
    if (found) return [found as unknown as FieldNode]
    report(`block reference "${block}" is not in the config's blocks`)
    return []
  }

  /** What a rich-text field's editor stores, from each feature's own schema map. */
  const editorChildren = (node: FieldNode): FieldNode[] => {
    const features = featureMap(node)
    if (!features) {
      report(`rich-text field "${node.name}" has an editor the walker does not know`)
      return []
    }
    const found: FieldNode[] = []
    for (const [key, feature] of features) {
      if (typeof feature?.generateSchemaMap === 'function') {
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
      } else if (!PLAIN_FEATURES.has(key) && !['link', 'relationship', 'upload'].includes(key)) {
        report(`unknown rich-text feature "${key}"`)
      }
    }
    return found
  }

  /** The fields, tabs and blocks directly inside one node, and what a rich-text editor stores. */
  const children = (node: FieldNode): FieldNode[] => {
    if (typeof node !== 'object' || node === null) {
      report('a value that is not an object')
      return []
    }
    const hasParts = [node.fields, node.tabs, node.blocks, node.blockReferences].some(
      (part) => part !== undefined,
    )
    if (node.type === undefined && !hasParts) {
      report(`a value of an unknown shape (${Object.keys(node).join(', ') || 'empty'})`)
    }
    if (node.type !== undefined && !KNOWN_TYPES.has(node.type)) {
      report(`unknown field type "${node.type}"${node.name ? ` (${node.name})` : ''}`)
    }
    return [
      ...(node.fields ?? []),
      ...(node.tabs ?? []),
      ...[...(node.blocks ?? []), ...(node.blockReferences ?? [])].flatMap(resolveBlock),
      ...(node.type === 'richText' ? editorChildren(node) : []),
    ]
  }

  /** Every field below `node`, however deeply nested. */
  const descendants = (node: FieldNode): FieldNode[] =>
    children(node).flatMap((child) => [child, ...descendants(child)])

  /**
   * The names an editor sees at the top of the document: layout-only containers (rows, unnamed
   * tabs, collapsibles) are looked through, a named group or tab counts once.
   */
  const topLevelFields = (fields: FieldNode[]): FieldNode[] =>
    fields.flatMap((field) => {
      if (field.name) return [field]
      if (field.type !== undefined && !LAYOUT_TYPES.has(field.type)) {
        report(`unnamed field of type "${field.type}" is not a layout container`)
      }
      return topLevelFields([...(field.fields ?? []), ...(field.tabs ?? [])])
    })

  /** Slugs from a feature's collection list, or every slug (less `disabled`) when it sets none. */
  const slugList = (key: string, value: unknown, all: string[], disabled?: unknown) => {
    if (value !== undefined && !isSlugList(value)) {
      report(`rich-text feature "${key}" lists collections in a shape the walker does not know`)
      return all
    }
    if (disabled !== undefined && !isSlugList(disabled)) {
      report(`rich-text feature "${key}" lists collections in a shape the walker does not know`)
      return all
    }
    return value ?? all.filter((slug) => !(disabled ?? []).includes(slug))
  }

  /** Collections a field points at: a relationship, or what a rich-text editor can link, relate or embed. */
  const targets = (node: FieldNode): string[] => {
    const own = [node.relationTo ?? [], node.collection ?? []].flat()
    if (node.type !== 'richText') return own
    const props = (key: string) =>
      (featureMap(node)?.get(key)?.sanitizedServerFeatureProps ?? {}) as Record<string, unknown>
    const features = featureMap(node)
    const found: string[] = [...own]
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

  return {
    children,
    descendants,
    topLevelFields,
    targets,
    /** Everything the walker did not recognise so far; each call hands it over and clears it. */
    drainProblems: () => problems.splice(0),
  }
}
