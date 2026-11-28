/**
 * Reads one example (#1532): the `defineExample({ purpose, render, settings?, of? })` of an export,
 * its settings as plain data and the source of its `render` with the helpers it uses.
 */
import ts from 'typescript'

import { exampleAnchor, exampleTitle } from './exampleNames.mjs'
import {
  COMPONENT_NAME,
  EXAMPLE_KEYS,
  PURPOSE_LIMIT,
  checkSettings,
  lineOf,
  literal,
} from './examplesChecks.mjs'

/** The text of a node without the indentation it has in the file. */
function dedented(node, sourceFile) {
  const [first, ...rest] = node.getText(sourceFile).split('\n')
  const indent = Math.min(...rest.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length))
  return [first, ...rest.map((line) => line.slice(Number.isFinite(indent) ? indent : 0))].join('\n')
}

/** The top-level declarations of the file that are not exported, by the names they declare. */
export function helperDeclarations(sourceFile) {
  const helpers = new Map()
  for (const statement of sourceFile.statements) {
    if (ts.getModifiers(statement)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue
    const names = ts.isVariableStatement(statement)
      ? statement.declarationList.declarations.map((d) => d.name.getText(sourceFile))
      : ts.isFunctionDeclaration(statement) ||
          ts.isTypeAliasDeclaration(statement) ||
          ts.isInterfaceDeclaration(statement)
        ? [statement.name?.text]
        : []
    for (const name of names) if (name) helpers.set(name, statement)
  }
  return helpers
}

/** The helpers a node uses, and the ones those use, in file order. */
function usedHelpers(node, helpers) {
  const used = new Set()
  const visit = (n) => {
    if (ts.isIdentifier(n) && helpers.has(n.text) && !used.has(helpers.get(n.text))) {
      used.add(helpers.get(n.text))
      visit(helpers.get(n.text))
    }
    ts.forEachChild(n, visit)
  }
  visit(node)
  return [...new Set(helpers.values())].filter((statement) => used.has(statement))
}

/** The entries of the example's object, each once and each a known one. */
function collectEntries(declaration, failHere) {
  const config = declaration.initializer.arguments[0]
  if (config !== undefined && !ts.isObjectLiteralExpression(config))
    failHere('must be written as an object')
  const entries = new Map()
  for (const entry of config?.properties ?? []) {
    if (
      !(ts.isPropertyAssignment(entry) || ts.isMethodDeclaration(entry)) ||
      !ts.isIdentifier(entry.name)
    ) {
      failHere('every entry must be written out (no spread, no computed name)')
    }
    const key = entry.name.text
    if (!EXAMPLE_KEYS.includes(key)) failHere(`has an entry it does not know: ${key}`)
    if (entries.has(key)) failHere(`has two ${key} entries`)
    entries.set(key, entry)
  }
  return entries
}

function readPurpose(entries, failHere) {
  const node = entries.get('purpose')?.initializer
  const purpose = node && ts.isStringLiteralLike(node) ? node.text : ''
  if (!purpose.trim()) failHere('has no purpose')
  if (purpose.includes('\n') || purpose.length > PURPOSE_LIMIT) {
    failHere(`the purpose is one line of at most ${PURPOSE_LIMIT} characters`)
  }
  return purpose
}

function findRender(entries, failHere) {
  const render = entries.get('render')
  const node = render && (ts.isPropertyAssignment(render) ? render.initializer : render)
  const isFunction =
    node &&
    (ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isMethodDeclaration(node))
  if (!isFunction) failHere('has no render function')
  return node
}

/** The plain-data entries `settings` and `of`, checked. */
function readData(entries, failHere) {
  const read = (key, whenMissing) => {
    const node = entries.get(key)?.initializer
    if (!node) return whenMissing
    try {
      return literal(node)
    } catch {
      return failHere(`${key} must be plain data (text, numbers, true, false, lists and objects)`)
    }
  }
  const settings = read('settings', {})
  if (entries.has('settings')) checkSettings(failHere, settings)
  const of = read('of', null)
  const names = [of].flat()
  const valid =
    names.length > 0 && names.every((n) => typeof n === 'string' && COMPONENT_NAME.test(n))
  if (of !== null && !valid) failHere('of must be a component name or a list of them')
  return { settings, of }
}

export function readExample(statement, declaration, sourceFile, fail, helpers) {
  const name = declaration.name.text
  const failHere = (text) =>
    fail(`${name}${/^(has|must|needs|is|passes|uses|references)/.test(text) ? ' ' : ': '}${text}`)
  const entries = collectEntries(declaration, failHere)
  const purpose = readPurpose(entries, failHere)
  const renderNode = findRender(entries, failHere)
  const { settings, of } = readData(entries, failHere)
  const used = usedHelpers(renderNode, helpers).map((helper) => dedented(helper, sourceFile))
  return {
    name,
    title: exampleTitle(name),
    anchor: exampleAnchor(name),
    purpose,
    of,
    settings,
    source: [...used, dedented(renderNode, sourceFile)].join('\n\n'),
    line: lineOf(statement, sourceFile),
  }
}
