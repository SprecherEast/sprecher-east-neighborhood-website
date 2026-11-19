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
 * type has them. `endpoints: false` and no endpoints both give none.
 */
export function describeEndpoints(endpoints, locate = noFiles) {
  if (!Array.isArray(endpoints)) return []
  return endpoints
    .map((endpoint) => ({
      method: String(endpoint.method).toUpperCase(),
      path: endpoint.path,
      name: functionLabel(endpoint.handler, 'handler').name,
      file: locate(endpoint.handler),
    }))
    .filter((endpoint) => endpoint.file !== 'payload')
}
