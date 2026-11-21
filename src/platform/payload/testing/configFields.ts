import type { Block } from 'payload'

import { createEditorReader } from './configEditor'

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

type WalkConfig = {
  collections: { slug: string; upload?: unknown }[]
  blocks?: Block[]
}

/** The list each container type must carry for the walker to see what is inside it. */
function missingList(node: FieldNode): string | null {
  const list = (value: unknown) => Array.isArray(value)
  switch (node.type) {
    case 'group':
    case 'array':
    case 'collapsible':
    case 'row':
      return list(node.fields) ? null : 'fields'
    case 'tabs':
      return list(node.tabs) ? null : 'tabs'
    case 'blocks':
      return list(node.blocks) || list(node.blockReferences) ? null : 'blocks'
    default:
      return null
  }
}

/** The property a field type needs to say what it points at, or null. */
const TARGET_PROPERTY: Record<string, 'relationTo' | 'collection'> = {
  relationship: 'relationTo',
  upload: 'relationTo',
  join: 'collection',
}

export function createFieldWalker(config: WalkConfig) {
  const problems: string[] = []
  const report = (message: string) => {
    if (!problems.includes(message)) problems.push(message)
  }
  const editor = createEditorReader(config, report)

  const resolveBlock = (block: FieldNode | string): FieldNode[] => {
    if (typeof block !== 'string') return [block]
    const found = config.blocks?.find((b) => b.slug === block)
    if (found) return [found as unknown as FieldNode]
    report(`block reference "${block}" is not in the config's blocks`)
    return []
  }

  /** Reports a node of a shape the walker cannot read: a bad type, or a container without its list. */
  const checkShape = (node: FieldNode) => {
    const parts = [node.fields, node.tabs, node.blocks, node.blockReferences]
    if (node.type === undefined && !parts.some((part) => Array.isArray(part))) {
      report(`a value of an unknown shape (${Object.keys(node).join(', ') || 'empty'})`)
    }
    if (node.type !== undefined && !KNOWN_TYPES.has(node.type)) {
      report(`unknown field type "${node.type}"${node.name ? ` (${node.name})` : ''}`)
    }
    const missing = missingList(node)
    if (missing) report(`${node.type} field "${node.name ?? ''}" has no ${missing}`)
  }

  const isObject = (value: unknown): value is FieldNode => {
    if (typeof value === 'object' && value !== null) return true
    report('a value that is not an object')
    return false
  }

  /** The fields, tabs and blocks directly inside one node, and what a rich-text editor stores. */
  const children = (node: FieldNode): FieldNode[] => {
    if (!isObject(node)) return []
    checkShape(node)
    return [
      ...(node.fields ?? []),
      ...(node.tabs ?? []),
      ...[...(node.blocks ?? []), ...(node.blockReferences ?? [])].flatMap(resolveBlock),
      ...(node.type === 'richText' ? editor.children(node) : []),
    ].filter(isObject)
  }

  /** Every field below `node`, however deeply nested. */
  const descendants = (node: FieldNode): FieldNode[] =>
    children(node).flatMap((child) => [child, ...descendants(child)])

  /**
   * The names an editor sees at the top of the document: layout-only containers (rows, unnamed
   * tabs, collapsibles) are looked through, a named group or tab counts once.
   */
  const topLevelFields = (fields: FieldNode[]): FieldNode[] =>
    fields.filter(isObject).flatMap((field) => {
      if (field.name) return [field]
      checkShape(field)
      if (field.type !== undefined && !LAYOUT_TYPES.has(field.type)) {
        report(`unnamed field of type "${field.type}" is not a layout container`)
      }
      return topLevelFields([...(field.fields ?? []), ...(field.tabs ?? [])])
    })

  /** Collections a field points at; a pointer field that names none is reported, never ignored. */
  const targets = (node: FieldNode): string[] => {
    const property = node.type === undefined ? undefined : TARGET_PROPERTY[node.type]
    if (property && node[property] === undefined) {
      report(`${node.type} field "${node.name ?? ''}" has no ${property}`)
    }
    const own = property ? [node[property] ?? []].flat() : []
    return node.type === 'richText' ? [...own, ...editor.targets(node)] : own
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
