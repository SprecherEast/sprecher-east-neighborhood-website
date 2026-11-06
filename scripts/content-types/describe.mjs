/**
 * Turns a loaded Payload config into plain data about each content type (#714): its fields, who
 * may do what, its hooks, its drafts. Pure functions with no file or database access, so they are
 * tested with small fixtures. `render.mjs` turns this data into Markdown.
 */

/** Operations in the order the pages list them; any other operation follows, sorted. */
const ACCESS_ORDER = ['create', 'read', 'update', 'delete', 'readVersions', 'unlock', 'admin']

/** Hook phases in the order Payload runs them; any other phase follows, sorted. */
const HOOK_PHASES = [
  'beforeOperation',
  'beforeValidate',
  'beforeChange',
  'afterChange',
  'beforeRead',
  'afterRead',
  'beforeDelete',
  'afterDelete',
  'beforeLogin',
  'afterLogin',
  'afterLogout',
  'afterMe',
  'afterRefresh',
  'afterForgotPassword',
  'afterOperation',
  'afterError',
]

const FIELD_ACCESS_ORDER = ['create', 'read', 'update', 'delete']
const CONTAINERS = new Set(['group', 'array', 'blocks'])
const UNKNOWN_FILE = 'unknown'

const rank = (order, key) => {
  const i = order.indexOf(key)
  return i === -1 ? order.length : i
}

const byOrder = (order) => (a, b) => rank(order, a) - rank(order, b) || a.localeCompare(b)

/**
 * Says where a function was written, from the script URL V8 records for it: a path under the
 * repo root as `src/...`, a package under `node_modules` by its name (Payload's own and the
 * plugins'), `unknown` for anything else. Never an absolute path, so the output is the same on
 * every machine.
 */
export function fileFromUrl(url, root) {
  if (!url) return UNKNOWN_FILE
  if (url.startsWith('node:')) return 'Node.js'
  const file = decodeURIComponent(url.replace(/^file:\/\//, '').replace(/\?.*$/, ''))
  const modules = file.lastIndexOf('/node_modules/')
  if (modules !== -1) {
    const parts = file.slice(modules + '/node_modules/'.length).split('/')
    return parts[0].startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
  }
  const prefix = `${root.replace(/\/+$/, '')}/`
  return file.startsWith(prefix) ? file.slice(prefix.length) : UNKNOWN_FILE
}

const noFiles = () => UNKNOWN_FILE

const nameOf = (fn) => (fn.name ? fn.name : 'inline')

/** Access functions by operation: `{ operation, name, file }`; `locate` says where a function lives. */
export function describeAccess(access = {}, locate = noFiles) {
  return Object.keys(access)
    .filter((operation) => typeof access[operation] === 'function')
    .sort(byOrder(ACCESS_ORDER))
    .map((operation) => ({
      operation,
      name: nameOf(access[operation]),
      file: locate(access[operation]),
    }))
}

/** Hooks by phase, each phase in Payload's order and each hook in the order it runs. */
export function describeHooks(hooks = {}, locate = noFiles) {
  return Object.keys(hooks)
    .sort(byOrder(HOOK_PHASES))
    .flatMap((phase) =>
      (hooks[phase] ?? []).map((fn) => ({ phase, name: nameOf(fn), file: locate(fn) })),
    )
}

/** What the `versions` setting means for drafts and history, as short lines. */
export function describeVersions(versions) {
  if (!versions) return ['Drafts: no', 'Versions: none kept']
  const lines = []
  const drafts = versions.drafts
  if (drafts) {
    const parts = []
    const autosave = typeof drafts === 'object' ? drafts.autosave : false
    parts.push(
      autosave
        ? `autosave every ${typeof autosave === 'object' ? (autosave.interval ?? 800) : 800} ms`
        : 'no autosave',
    )
    if (typeof drafts === 'object' && drafts.schedulePublish) parts.push('scheduled publishing')
    lines.push(`Drafts: yes (${parts.join(', ')})`)
  } else {
    lines.push('Drafts: no')
  }
  lines.push(
    versions.maxPerDoc === 0
      ? 'Versions: all kept'
      : `Versions: the last ${versions.maxPerDoc ?? 100} of each document`,
  )
  return lines
}

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

const LIMITS = [
  ['minLength', 'min length'],
  ['maxLength', 'max length'],
  ['min', 'min'],
  ['max', 'max'],
  ['minRows', 'min rows'],
  ['maxRows', 'max rows'],
]

function fieldNotes(field) {
  const notes = []
  if (field.admin?.hidden) notes.push('hidden')
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
  const byName = new Map()
  for (const operation of FIELD_ACCESS_ORDER) {
    if (typeof access[operation] !== 'function') continue
    const name = nameOf(access[operation])
    byName.set(name, [...(byName.get(name) ?? []), operation])
  }
  return [...byName].map(([name, operations]) => `${operations.join(', ')}: ${name}`)
}

function tabLabel(tab) {
  if (typeof tab.label === 'string') return tab.label
  return tab.name ?? 'Tab'
}

/**
 * One row per data field, in config order, with a path (`hero.links[].link`, `layout{cta}.heading`),
 * its type, whether it is required, its target or options, notes, field access, field hooks and
 * the section it belongs to: a tab's label, or the name of a top-level group, array or blocks
 * field. Layout fields (row, collapsible, tabs) add no row; `ui` fields hold no data and are left out.
 */
export function describeFields(fields, { locate = noFiles, prefix = '', section = null } = {}) {
  const rows = []
  const top = section === null
  const sectionOf = (field) => (top && CONTAINERS.has(field.type) ? field.name : (section ?? ''))
  for (const field of fields) {
    if (field.type === 'ui') continue
    if (field.type === 'row' || field.type === 'collapsible') {
      rows.push(...describeFields(field.fields, { locate, prefix, section }))
      continue
    }
    if (field.type === 'tabs') {
      for (const tab of field.tabs) {
        rows.push(
          ...describeFields(tab.fields, {
            locate,
            prefix: tab.name ? `${prefix}${tab.name}.` : prefix,
            section: section ?? tabLabel(tab),
          }),
        )
      }
      continue
    }
    if (!field.name) continue
    const path = `${prefix}${field.name}`
    const mine = sectionOf(field)
    rows.push({
      path,
      type: field.type,
      required: field.required ? 'yes' : 'no',
      detail: fieldDetail(field),
      notes: fieldNotes(field),
      section: mine,
      access: fieldAccess(field.access),
      hooks: describeHooks(field.hooks, locate),
    })
    const inner = { locate, section: mine }
    if (field.type === 'group') {
      rows.push(...describeFields(field.fields, { ...inner, prefix: `${path}.` }))
    } else if (field.type === 'array') {
      rows.push(...describeFields(field.fields, { ...inner, prefix: `${path}[].` }))
    } else if (field.type === 'blocks') {
      for (const block of field.blocks ?? []) {
        const blockPath = `${path}{${block.slug}}`
        rows.push({
          path: blockPath,
          type: 'block',
          required: 'no',
          detail: '',
          notes: [],
          section: mine,
          access: [],
          hooks: [],
        })
        rows.push(...describeFields(block.fields, { ...inner, prefix: `${blockPath}.` }))
      }
    }
  }
  return rows
}

/**
 * Settings of `auth` or `upload` as sorted `[name, value]` pairs: scalars as they are, functions
 * by name, lists by their size, objects one level at a time (`cookies.secure`). Absolute paths
 * under `root` are made relative, so the output is the same on every machine.
 */
export function describeSettings(settings, { root = '', prefix = '' } = {}) {
  if (!settings || typeof settings !== 'object') return []
  const pairs = []
  for (const key of Object.keys(settings).sort()) {
    const value = settings[key]
    const name = `${prefix}${key}`
    if (value === undefined || value === null) continue
    if (typeof value === 'function') pairs.push([name, nameOf(value)])
    else if (Array.isArray(value)) pairs.push([name, listSetting(key, value)])
    else if (typeof value === 'object')
      pairs.push(...describeSettings(value, { root, prefix: `${name}.` }))
    else if (typeof value === 'string' && root && value.startsWith(root)) {
      pairs.push([name, value.slice(root.length).replace(/^[\\/]+/, '')])
    } else pairs.push([name, String(value)])
  }
  return pairs
}

function listSetting(key, list) {
  if (key === 'imageSizes') {
    return list
      .map((size) => `${size.name} ${size.width ?? 'auto'}x${size.height ?? 'auto'}`)
      .join(', ')
  }
  return `${list.length} item${list.length === 1 ? '' : 's'}`
}

/** Everything a page needs about one collection or global. */
export function describeContentType(entry, kind, { locate = noFiles, root = '' } = {}) {
  const label = entry.labels?.plural ?? entry.labels?.singular ?? entry.label
  const title = typeof label === 'string' ? label : entry.slug
  const description = entry.admin?.description
  return {
    slug: entry.slug,
    kind,
    title,
    purpose: typeof description === 'string' ? description : '',
    versions: describeVersions(entry.versions),
    access: describeAccess(entry.access, locate),
    hooks: describeHooks(entry.hooks, locate),
    fields: describeFields(entry.fields ?? [], { locate }),
    auth: describeSettings(entry.auth, { root }),
    upload: describeSettings(entry.upload, { root }),
  }
}
