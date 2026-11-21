import { editorBlocks } from './editorBlocks'

/**
 * Finds the references in one document and drops the ones the preview copy must not follow
 * (#1396, part of #1077). A reference is a relationship, upload or rich-text link, upload or
 * relationship node, read at depth 0, so it is an id. The walk follows the Payload field config,
 * the same shapes `testing/configFields.ts` reads for the gate, but over a document's values.
 *
 * It fails closed: a field type, rich-text node or block it does not know throws, so something
 * new cannot carry a reference past it. Plain data in, plain data out; no Payload import.
 */

export type Reference = { relationTo: string; id: string | number }
/** True keeps the reference; false drops it. */
export type KeepReference = (reference: Reference) => boolean

type Field = {
  name?: string
  type?: string
  fields?: Field[]
  tabs?: Field[]
  blocks?: BlockDef[]
  blockReferences?: (BlockDef | string)[]
  relationTo?: string | string[]
  hasMany?: boolean
  editor?: unknown
}
export type BlockDef = { slug: string; fields: Field[] }
type Json = Record<string, unknown>

/** Field types that hold no reference and no child fields. */
const LEAF_TYPES = new Set([
  'checkbox',
  'code',
  'date',
  'email',
  'json',
  'number',
  'point',
  'radio',
  'select',
  'text',
  'textarea',
  // A join is computed on read from the other side and stores nothing
  'join',
  'ui',
])
const LAYOUT_TYPES = new Set(['row', 'collapsible'])
/** Lexical nodes that hold only text and formatting, with children of their own. */
const PLAIN_NODES = new Set([
  'root',
  'paragraph',
  'heading',
  'text',
  'linebreak',
  'tab',
  'list',
  'listitem',
  'quote',
  'horizontalrule',
])

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isId = (value: unknown): value is string | number =>
  typeof value === 'string' || typeof value === 'number'

/** The fields that carry a value of their own: layout containers and unnamed tabs are looked through. */
export function namedFields(fields: Field[]): Field[] {
  return fields.flatMap((field) => {
    if (field.name) return [field]
    if (field.type === 'tabs') return namedFields(field.tabs ?? [])
    if (field.type === 'tab' || (field.type && LAYOUT_TYPES.has(field.type)) || !field.type) {
      return namedFields(field.fields ?? [])
    }
    throw new Error(`Preview copy: unnamed field of type "${field.type}" is not a layout container`)
  })
}

export type ReferenceWalk = { data: Json; dropped: number }

/**
 * A copy of `data` without the references `keep` refuses. `blocks` finds a block by slug, for
 * block references and the blocks a rich-text editor embeds.
 */
export function walkReferences(args: {
  fields: Field[]
  data: Json
  blocks: (slug: string) => BlockDef | undefined
  keep: KeepReference
}): ReferenceWalk {
  let dropped = 0
  const keep = (reference: Reference) => {
    const kept = args.keep(reference)
    if (!kept) dropped += 1
    return kept
  }

  /** One stored reference: an id, or `{ relationTo, value }` when the field can point at several. */
  const pointer = (field: Field, value: unknown): unknown => {
    const targets = [field.relationTo ?? []].flat()
    if (value === null || value === undefined) return value
    if (Array.isArray(field.relationTo)) {
      if (!isObject(value) || typeof value.relationTo !== 'string' || !('value' in value)) {
        throw new Error(`Preview copy: ${field.name} holds a reference of an unknown shape`)
      }
      if (value.value === null) return value
      if (!isId(value.value)) {
        throw new Error(`Preview copy: ${field.name} holds a reference that is not an id`)
      }
      return keep({ relationTo: value.relationTo, id: value.value }) ? value : null
    }
    if (!isId(value))
      throw new Error(`Preview copy: ${field.name} holds a reference that is not an id`)
    return keep({ relationTo: targets[0] as string, id: value }) ? value : null
  }

  const walkField = (field: Field, value: unknown): unknown => {
    if (value === null || value === undefined) return value
    const type = field.type ?? ''
    if (LEAF_TYPES.has(type)) return value
    switch (type) {
      case 'relationship':
      case 'upload':
        if (field.hasMany) {
          if (!Array.isArray(value)) throw new Error(`Preview copy: ${field.name} is not a list`)
          return value.map((item) => pointer(field, item)).filter((item) => item !== null)
        }
        return pointer(field, value)
      // A named tab has no type of its own and stores its fields like a group
      case 'group':
      case 'tab':
      case '':
        if (!isObject(value)) throw new Error(`Preview copy: ${field.name} is not an object`)
        return walkObject(namedFields(field.fields ?? []), value)
      case 'array':
        if (!Array.isArray(value)) throw new Error(`Preview copy: ${field.name} is not a list`)
        return value.map((row) => walkObject(namedFields(field.fields ?? []), row))
      case 'blocks':
        if (!Array.isArray(value)) throw new Error(`Preview copy: ${field.name} is not a list`)
        return value.map((row) => walkBlock(row, field))
      case 'richText':
        return walkRichText(field, value)
      default:
        throw new Error(`Preview copy: unknown field type "${type}" (${field.name ?? ''})`)
    }
  }

  const walkObject = (fields: Field[], value: unknown): Json => {
    if (!isObject(value)) throw new Error('Preview copy: a group or row is not an object')
    const out: Json = { ...value }
    for (const field of fields) {
      if (field.name && field.name in out) out[field.name] = walkField(field, out[field.name])
    }
    return out
  }

  const block = (slug: unknown, field: Field): BlockDef => {
    const listed = [...(field.blocks ?? []), ...(field.blockReferences ?? [])]
    const own = listed.find((b) => (typeof b === 'string' ? b : b.slug) === slug)
    const found =
      typeof own === 'object' ? own : typeof slug === 'string' ? args.blocks(slug) : undefined
    if (!found) throw new Error(`Preview copy: block "${String(slug)}" is not in ${field.name}`)
    return found
  }

  const walkBlock = (row: unknown, field: Field): Json => {
    if (!isObject(row)) throw new Error(`Preview copy: a block of ${field.name} is not an object`)
    return walkObject(namedFields(block(row.blockType, field).fields), row)
  }

  /** A Lexical document: the nodes that reference documents are checked, the rest walked through. */
  const walkRichText = (field: Field, value: unknown): unknown => {
    if (!isObject(value) || !isObject(value.root)) {
      throw new Error(`Preview copy: ${field.name} is not a Lexical document`)
    }
    const embedded: Field = { name: field.name, blockReferences: editorBlocks(field) }
    const node = (current: unknown): Json | null => {
      if (!isObject(current) || typeof current.type !== 'string') {
        throw new Error(`Preview copy: ${field.name} holds a node of an unknown shape`)
      }
      const type = current.type
      if (type === 'upload' || type === 'relationship') {
        if (isObject(current.fields) && Object.keys(current.fields).length > 0) {
          throw new Error(`Preview copy: ${field.name} holds a ${type} with extra fields`)
        }
        if (typeof current.relationTo !== 'string' || !isId(current.value)) {
          throw new Error(`Preview copy: ${field.name} holds a ${type} that is not an id`)
        }
        return keep({ relationTo: current.relationTo, id: current.value }) ? current : null
      }
      if (type === 'link' || type === 'autolink') {
        const fields = isObject(current.fields) ? current.fields : {}
        const doc = fields.doc
        const children = nodes(current.children)
        if (doc === null || doc === undefined) return { ...current, children }
        if (!isObject(doc) || typeof doc.relationTo !== 'string' || !('value' in doc)) {
          throw new Error(`Preview copy: ${field.name} holds a link of an unknown shape`)
        }
        if (doc.value !== null && !isId(doc.value)) {
          throw new Error(`Preview copy: ${field.name} holds a link that is not an id`)
        }
        // Like a deleted document: the link stays as text, pointing nowhere
        const kept =
          doc.value === null ||
          keep({ relationTo: doc.relationTo, id: doc.value as string | number })
        return {
          ...current,
          fields: { ...fields, doc: kept ? doc : { ...doc, value: null } },
          children,
        }
      }
      if (type === 'block' || type === 'inlineBlock') {
        if (!isObject(current.fields))
          throw new Error(`Preview copy: ${field.name} holds a block without fields`)
        const fields = walkObject(
          namedFields(block(current.fields.blockType, embedded).fields),
          current.fields,
        )
        return { ...current, fields }
      }
      if (!PLAIN_NODES.has(type)) {
        throw new Error(`Preview copy: ${field.name} holds an unknown rich-text node "${type}"`)
      }
      return Array.isArray(current.children)
        ? { ...current, children: nodes(current.children) }
        : current
    }
    const nodes = (list: unknown): Json[] => {
      if (list === undefined) return []
      if (!Array.isArray(list))
        throw new Error(`Preview copy: ${field.name} holds a node list of an unknown shape`)
      return list.flatMap((item) => {
        const result = node(item)
        return result ? [result] : []
      })
    }
    return { ...value, root: node(value.root) }
  }

  const data = walkObject(namedFields(args.fields), args.data)
  return { data, dropped }
}
