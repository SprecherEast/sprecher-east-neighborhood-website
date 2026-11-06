import inspector from 'node:inspector'

import { fileFromUrl } from './describe.mjs'

/**
 * Finds the file a function was written in, with V8's own record of where it was compiled (the
 * `[[FunctionLocation]]` the inspector shows), so two functions with one name are told apart and
 * an anonymous function still has a file. Needs no source scan and no guess from the name. Create
 * it after the config is loaded: enabling the debugger replays every script already parsed.
 */
export function createLocator(root) {
  const session = new inspector.Session()
  session.connect()
  const urls = new Map()
  session.on('Debugger.scriptParsed', ({ params }) => urls.set(params.scriptId, params.url))
  session.post('Debugger.enable')

  const slot = '__contentTypeDocsFunction'
  return (fn) => {
    if (typeof fn !== 'function') return String(fn)
    globalThis[slot] = fn
    let objectId
    session.post('Runtime.evaluate', { expression: slot }, (error, result) => {
      objectId = result?.result?.objectId
    })
    delete globalThis[slot]
    let scriptId
    if (objectId) {
      session.post('Runtime.getProperties', { objectId }, (error, result) => {
        const location = result?.internalProperties?.find((p) => p.name === '[[FunctionLocation]]')
        scriptId = location?.value?.value?.scriptId
      })
    }
    return fileFromUrl(urls.get(scriptId), root)
  }
}
