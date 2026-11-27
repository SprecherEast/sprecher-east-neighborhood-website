/**
 * What the reader holds an examples file to (#1532): the shape of an example's settings and the
 * names it may not touch (imports are in `examplesImports.mjs`, markup in `examplesMarkup.mjs`). This
 * guards against mistakes; it is not a sandbox.
 */
import ts from 'typescript'

import { checkMarkup } from './examplesMarkup.mjs'

export const PURPOSE_LIMIT = 120
export const SETTING_DEFAULTS = { boolean: 'boolean', text: 'string', choice: 'string' }
export const EXAMPLE_KEYS = ['purpose', 'of', 'settings', 'render']
export const SETTING_KEYS = ['kind', 'default', 'options', 'description']
export const COMPONENT_NAME = /^[A-Z][A-Za-z0-9]*$/
// Names that reach the environment, the machine, the network, the page or a timer: no example
// needs one. This guards against mistakes; it is not a sandbox (an example is code that runs at
// build time, so review stays the control)
const FORBIDDEN = new Set([
  'global',
  'module',
  'exports',
  'Buffer',
  '__dirname',
  '__filename',
  'Reflect',
  'Proxy',
  'Worker',
  'SharedWorker',
  'Deno',
  'Bun',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'caches',
  'location',
  'history',
  'navigator',
  'top',
  'parent',
  'frames',
  'opener',
  'setTimeout',
  'setInterval',
  'setImmediate',
  'queueMicrotask',
  'importScripts',
  'postMessage',
  'BroadcastChannel',
  'process',
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
  'globalThis',
  'window',
  'self',
  'document',
  'require',
  'eval',
  'Function',
  'Image',
  'open',
  'requestAnimationFrame',
  'requestIdleCallback',
  'cancelAnimationFrame',
  'RTCPeerConnection',
  'WebTransport',
  'fetchLater',
  'cookieStore',
  'CSS',
  'alert',
  'confirm',
  'prompt',
  'Audio',
  'Notification',
])
/** The value of a literal in the source: text, number, boolean, list or object of those. */
export function literal(node) {
  if (ts.isStringLiteralLike(node)) return node.text
  if (ts.isNumericLiteral(node)) return Number(node.text)
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal)
  if (ts.isObjectLiteralExpression(node)) {
    return Object.fromEntries(
      node.properties.map((p) => {
        if (
          !ts.isPropertyAssignment(p) ||
          !(ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))
        ) {
          throw new Error('not a literal')
        }
        return [p.name.text, literal(p.initializer)]
      }),
    )
  }
  throw new Error('not a literal')
}

export const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
const unknownKey = (object, known) => Object.keys(object).find((key) => !known.includes(key))

export function checkSettings(fail, settings) {
  if (!isPlainObject(settings)) fail('settings must be an object of settings')
  for (const [key, setting] of Object.entries(settings)) {
    const label = `setting ${key}`
    if (!isPlainObject(setting)) fail(`${label} must be an object`)
    const { kind, options } = setting
    if (!(kind in SETTING_DEFAULTS)) fail(`${label} has kind ${kind}`)
    const other = unknownKey(
      setting,
      kind === 'choice' ? SETTING_KEYS : SETTING_KEYS.filter((k) => k !== 'options'),
    )
    if (other) fail(`${label} has an entry it does not know: ${other}`)
    if (typeof setting.default !== SETTING_DEFAULTS[kind])
      fail(`${label} needs a default of its kind`)
    if ('description' in setting && typeof setting.description !== 'string') {
      fail(`${label} needs a description of text`)
    }
    if (kind !== 'choice') continue
    if (
      !Array.isArray(options) ||
      options.length === 0 ||
      !options.every((o) => typeof o === 'string')
    ) {
      fail(`${label} needs options, a list of text`)
    }
    if (new Set(options).size !== options.length) fail(`${label} has an option twice`)
    if (!options.includes(setting.default))
      fail(`${label} has a default that is not one of its options`)
  }
}

/** Whether an identifier is only a name (`a.process`, `{ fetch: 1 }`, a JSX attribute), not a use. */
export const isNameOnly = (node) =>
  (ts.isPropertyAccessExpression(node.parent) && node.parent.name === node) ||
  ((ts.isPropertyAssignment(node.parent) || ts.isJsxAttribute(node.parent)) &&
    node.parent.name === node)

/** The line of a node, counted from 1. */
export const lineOf = (node, sourceFile) =>
  sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1

/** What a server file may not do: it is drawn by a server page, which can pass no function to a client. */
export function checkServerOnly(node, sourceFile, fail, clientFile, owner) {
  const move = `goes in ${clientFile}`
  if (ts.isJsxAttribute(node) && /^on[A-Z]/.test(node.name.getText(sourceFile))) {
    fail(`${owner}passes ${node.name.getText(sourceFile)}; an example with a handler ${move}`)
  }
  if (ts.isIdentifier(node) && /^use[A-Z]/.test(node.text) && !isNameOnly(node)) {
    fail(`${owner}uses ${node.text}; an example with state or effects ${move}`)
  }
}

/** Every refusal that applies anywhere in the file: imports, dynamic loading, the environment. */
export function checkNode(node, sourceFile, fail, owner) {
  const at = `(line ${lineOf(node, sourceFile)})`
  if (ts.isImportEqualsDeclaration(node)) fail(`${owner}import x = require(…) is not allowed ${at}`)
  if (ts.isImportTypeNode(node)) fail(`${owner}a dynamic import type is not allowed ${at}`)
  if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
    fail(`${owner}a dynamic import() is not allowed ${at}`)
  }
  if (ts.isMetaProperty(node)) fail(`${owner}import.meta is not allowed ${at}`)
  if (ts.isIdentifier(node) && FORBIDDEN.has(node.text) && !isNameOnly(node)) {
    fail(`${owner}references ${node.text} ${at}`)
  }
  checkMarkup(node, sourceFile, fail, owner, at)
}
