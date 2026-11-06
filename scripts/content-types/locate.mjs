import inspector from 'node:inspector'

import { fileFromUrl } from './functions.mjs'

/**
 * Finds the file a function was written in, with V8's own record of where it was compiled (the
 * `[[FunctionLocation]]` the inspector shows), so two functions with one name are told apart and
 * an anonymous function still has a file. A bound function is followed to the function it wraps.
 * Needs no source scan and no guess from the name. Create it after the config is loaded: enabling
 * the debugger replays every script already parsed. Call `close` when done.
 */
export function createLocator(root) {
  const session = new inspector.Session()
  session.connect()
  const urls = new Map()
  session.on('Debugger.scriptParsed', ({ params }) => urls.set(params.scriptId, params.url))
  session.post('Debugger.enable')

  /** Posts a command; the in-thread session answers before `post` returns. */
  const ask = (method, params) => {
    let answer
    session.post(method, params, (error, result) => {
      answer = error ? undefined : result
    })
    return answer
  }

  const scriptOf = (objectId) => {
    const properties = ask('Runtime.getProperties', { objectId })?.internalProperties ?? []
    const location = properties.find((p) => p.name === '[[FunctionLocation]]')
    if (location) return location.value?.value?.scriptId
    const target = properties.find((p) => p.name === '[[TargetFunction]]')
    return target?.value?.objectId ? scriptOf(target.value.objectId) : undefined
  }

  const slot = '__contentTypeDocsFunction'
  const locate = (fn) => {
    if (typeof fn !== 'function') return String(fn)
    globalThis[slot] = fn
    const objectId = ask('Runtime.evaluate', { expression: slot })?.result?.objectId
    delete globalThis[slot]
    return fileFromUrl(objectId ? urls.get(scriptOf(objectId)) : undefined, root)
  }

  return { locate, close: () => session.disconnect() }
}
