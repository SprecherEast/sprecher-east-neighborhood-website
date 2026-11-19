/**
 * One row per data field of a content type: path, type, whether it is required, target or
 * options, notes, field access and field hooks. Pure.
 */
import { describeHooks, noFiles } from './callbacks.mjs'
import { functionLabel, labelText } from './functions.mjs'

const FIELD_ACCESS_ORDER = ['create', 'read', 'update', 'delete']
const CONTAINERS = new Set(['group', 'array', 'blocks'])

const LIMITS = [
  ['minLength', 'min length'],
  ['maxLength', 'max length'],
  ['min', 'min'],
  ['max', 'max'],
  ['minRows', 'min rows'],
  ['maxRows', 'max rows'],
]

const optionValue = (option) => (typeof option === 'object' ? option.value : option)

const asList = (value) => (Array.isArray(value) ? value : [value])

function fieldDetail(field) {
  switch (field.type) {
    case 'relationship':
    case 'upload':
      return `→ ${asList(field.relationTo).join(', ')}${field.hasMany ? ' (many)' : ''}`
    case 'join':
      return `← ${field.collection}.${field.on}`
    case 'select':
    case 'radio':
      return (field.options ?? []).map(optionValue).join(', ')
    case 'blocks':
      return `blocks: ${(field.blocks ?? []).map((block) => block.slug).join(', ')}`
    default:
      return ''
  }
}

function fieldNotes(field) {
  const notes = []
  if (field.hidden || field.admin?.hidden) notes.push('hidden')
  if (field.admin?.readOnly) notes.push('read only')
  if (field.unique) notes.push('unique')
  if (field.index) notes.push('indexed')
  if (field.localized) notes.push('localized')
  for (const [key, label] of LIMITS) {
    if (typeof field[key] === 'number') notes.push(`${label} ${field[key]}`)
  }
  if (['string', 'number', 'boolean'].includes(typeof field.defaultValue)) {
    notes.push(`default ${field.defaultValue}`)
  }
  if (typeof field.admin?.condition === 'function') notes.push('shown conditionally')
  return notes
}

/** `create, read, update: nobody`: the operations that share a function are joined. */
function fieldAccess(access = {}) {
  const byLabel = new Map()
  for (const operation of FIELD_ACCESS_ORDER) {
    if (typeof access[operation] !== 'function') continue
    const label = labelText(functionLabel(access[operation], operation))
    byLabel.set(label, [...(byLabel.get(label) ?? []), operation])
  }
  return [...byLabel].map(([label, operations]) => `${operations.join(', ')}: ${label}`)
}

function tabLabel(tab) {
  return typeof tab.label === 'string' ? tab.label : (tab.name ?? 'Tab')
}

const fieldRow = (field, path, section, locate) => ({
  path,
  type: field.type,
  required: field.required ? 'yes' : 'no',
  detail: fieldDetail(field),
  notes: fieldNotes(field),
  section,
  access: fieldAccess(field.access),
  hooks: describeHooks(field.hooks, locate),
})

const blockRow = (path, section) => ({
  path,
  type: 'block',
  required: 'no',
  detail: '',
  notes: [],
  section,
  access: [],
  hooks: [],
})

function describeBlocks(field, path, section, locate) {
  return (field.blocks ?? []).flatMap((block) => {
    const blockPath = `${path}{${block.slug}}`
    return [
      blockRow(blockPath, section),
      ...describeFields(block.fields, { locate, prefix: `${blockPath}.`, section }),
    ]
  })
}

function describeChildren(field, path, section, locate) {
  const inner = { locate, section }
  if (field.type === 'group') return describeFields(field.fields, { ...inner, prefix: `${path}.` })
  if (field.type === 'array')
    return describeFields(field.fields, { ...inner, prefix: `${path}[].` })
  if (field.type === 'blocks') return describeBlocks(field, path, section, locate)
  return []
}

function describeField(field, { locate, prefix, section }) {
  if (field.type === 'ui') return []
  if (field.type === 'row' || field.type === 'collapsible') {
    return describeFields(field.fields, { locate, prefix, section })
  }
  if (field.type === 'tabs') {
    return field.tabs.flatMap((tab) =>
      describeFields(tab.fields, {
        locate,
        prefix: tab.name ? `${prefix}${tab.name}.` : prefix,
        section: section ?? tabLabel(tab),
      }),
    )
  }
  if (!field.name) return []
  const path = `${prefix}${field.name}`
  // A top-level group, array or blocks field is its own section; everything else follows its parent
  const mine = section === null && CONTAINERS.has(field.type) ? field.name : (section ?? '')
  return [fieldRow(field, path, mine, locate), ...describeChildren(field, path, mine, locate)]
}

/**
 * One row per data field, in config order, with a path (`hero.links[].link`, `layout{cta}.heading`)
 * and the section it belongs to: a tab's label, or the name of a top-level group, array or blocks
 * field. Layout fields (row, collapsible, tabs) add no row; `ui` fields hold no data and are left out.
 */
export function describeFields(fields, { locate = noFiles, prefix = '', section = null } = {}) {
  return fields.flatMap((field) => describeField(field, { locate, prefix, section }))
}
