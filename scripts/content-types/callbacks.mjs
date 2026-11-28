/**
 * The functions a content type or field runs: who may do what (access), what runs around a change
 * (hooks) and custom endpoints, each with the function's name and the file it lives in. Pure: the
 * caller gives `locate`, which says where a function was written.
 */
import { UNKNOWN_FILE, functionLabel } from './functions.mjs'

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

export const noFiles = () => UNKNOWN_FILE

const rank = (order, key) => {
  const i = order.indexOf(key)
  return i === -1 ? order.length : i
}

export const byOrder = (order) => (a, b) => rank(order, a) - rank(order, b) || a.localeCompare(b)

/** Access functions by operation: `{ operation, name, note, file }`. */
export function describeAccess(access = {}, locate = noFiles) {
  return Object.keys(access)
    .filter((operation) => typeof access[operation] === 'function')
    .sort(byOrder(ACCESS_ORDER))
    .map((operation) => ({
      operation,
      ...functionLabel(access[operation], operation),
      file: locate(access[operation]),
    }))
}

/** Hooks by phase, each phase in Payload's order and each hook in the order it runs. */
export function describeHooks(hooks = {}, locate = noFiles) {
  return Object.keys(hooks)
    .sort(byOrder(HOOK_PHASES))
    .flatMap((phase) =>
      (hooks[phase] ?? []).map((fn) => ({
        phase,
        ...functionLabel(fn, phase),
        file: locate(fn),
      })),
    )
}

/**
 * Custom endpoints in config order: those this site or a plugin adds. The REST routes Payload
 * gives every collection (find, create, delete, login and the rest) are left out, since every
 * type has them, unless `builtIn` asks for them too. `endpoints: false` and no endpoints both
 * give none.
 */
export function describeEndpoints(endpoints, locate = noFiles, { builtIn = false } = {}) {
  if (!Array.isArray(endpoints)) return []
  const described = endpoints.map((endpoint) => ({
    method: String(endpoint.method).toUpperCase(),
    path: endpoint.path,
    name: functionLabel(endpoint.handler, 'handler').name,
    file: locate(endpoint.handler),
  }))
  return described
    .map((endpoint, index) => ({
      ...endpoint,
      ...replacement(described.slice(0, index), endpoint),
    }))
    .filter((endpoint) => builtIn || endpoint.file !== 'payload')
    .map((endpoint) => (builtIn ? endpoint : withoutReplacement(endpoint)))
}

const withoutReplacement = ({ replacedBy, replacedWhen, ...endpoint }) => endpoint

function replacement(earlier, endpoint) {
  for (const candidate of earlier) {
    const taken = takesFirst(candidate, endpoint)
    if (taken) return { replacedBy: candidate, replacedWhen: taken.when }
  }
  return { replacedBy: null, replacedWhen: null }
}

/**
 * Payload takes the first endpoint of a type whose method and path match the request. An earlier
 * endpoint takes every request a later one would get when its pattern matches the later pattern
 * as a request (`:id` stands for any one segment). A later path with an optional segment (`:id?`)
 * is asked both with and without it: it is `taken` when every form is matched, `partly` when only
 * some are (those forms are in `when`).
 */
function takesFirst(earlier, later) {
  if (earlier.method !== later.method) return null
  const forms = requestForms(later.path)
  const matched = forms.filter((form) => matches(earlier.path, form))
  if (matched.length === 0) return null
  return { when: matched.length === forms.length ? null : matched }
}

/** The request paths a pattern can get: each optional segment once present and once absent. */
function requestForms(path) {
  const segments = path.split('/').filter(Boolean)
  return segments
    .reduce(
      (forms, segment) => {
        const name = segment.replace(/\?$/, '')
        if (!segment.endsWith('?')) return forms.map((form) => [...form, name])
        return forms.flatMap((form) => [form, [...form, name]])
      },
      [[]],
    )
    .map((form) => `/${form.join('/')}`)
}

function matches(pattern, request) {
  const source = pattern
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      if (!segment.startsWith(':')) return `/${segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`
      return segment.endsWith('?') ? '(?:/[^/]+)?' : '/[^/]+'
    })
    .join('')
  return new RegExp(`^${source || '/'}$`).test(request)
}
