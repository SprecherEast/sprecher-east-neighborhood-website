/**
 * Drafts, versions and the `auth` and `upload` settings, as short lines and pairs. Pure.
 */
import { rootPrefix } from './functions.mjs'

/** What the drafts and versions setting means, as short lines. */
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

/**
 * Settings Payload fills in when nobody chose one and that carry no decision of this site, left
 * out of the tables so they only show what is set on purpose. A Payload upgrade that changes a
 * default makes the new value show, which is the safe side.
 */
const PAYLOAD_DEFAULTS = new Map([
  ['cookies.sameSite', 'Lax'],
  ['forgotPassword.minRequestInterval', '15000'],
  ['loginWithUsername', 'false'],
  ['useSessions', 'true'],
])

function listSetting(key, list) {
  if (key === 'imageSizes') {
    return list
      .map((size) => `${size.name} ${size.width ?? 'auto'}x${size.height ?? 'auto'}`)
      .join(', ')
  }
  return `${list.length} item${list.length === 1 ? '' : 's'}`
}

function scalarSetting(value, root) {
  const text = String(value)
  const prefix = rootPrefix(root)
  return root && text.startsWith(prefix) ? text.slice(prefix.length) : text
}

/**
 * Settings of `auth` or `upload` as sorted `[name, value]` pairs: scalars as they are, functions
 * by name, lists by their size (none when empty), objects one level at a time (`cookies.secure`).
 * Absolute paths under `root` are made relative, so the output is the same on every machine.
 */
export function describeSettings(settings, { root = '', prefix = '' } = {}) {
  if (!settings || typeof settings !== 'object') return []
  const pairs = []
  for (const key of Object.keys(settings).sort()) {
    const value = settings[key]
    const name = `${prefix}${key}`
    if (value === undefined || value === null) continue
    if (typeof value === 'function') pairs.push([name, value.name || 'inline'])
    else if (Array.isArray(value)) {
      if (value.length > 0) pairs.push([name, listSetting(key, value)])
    } else if (typeof value === 'object') {
      pairs.push(...describeSettings(value, { root, prefix: `${name}.` }))
    } else if (PAYLOAD_DEFAULTS.get(name) !== String(value)) {
      pairs.push([name, scalarSetting(value, root)])
    }
  }
  return pairs
}
