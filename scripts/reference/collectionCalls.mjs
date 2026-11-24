/**
 * The collections a tool or task reaches through Payload's Local API (#1461), found by following
 * the calls from its handler in the source, with each operation and whether access is checked.
 */
import path from 'node:path'
import ts from 'typescript'

import { isSource, literalValues, property, propertyValues, valueOf, walkAll } from './ast.mjs'

const OPERATIONS = {
  find: 'read',
  findByID: 'read',
  count: 'read',
  create: 'create',
  update: 'update',
  updateMany: 'update',
  delete: 'delete',
  deleteMany: 'delete',
}

/** `payload.find(…)` or `req.payload.db.deleteMany(…)`: the method name and whether it is on `db`. */
function payloadMethod(call) {
  const callee = call.expression
  if (!ts.isPropertyAccessExpression(callee) || !(callee.name.text in OPERATIONS)) return undefined
  const owner = callee.expression
  const onDb = ts.isPropertyAccessExpression(owner) && owner.name.text === 'db'
  const base = onDb ? owner.expression : owner
  const isPayload =
    (ts.isIdentifier(base) && base.text === 'payload') ||
    (ts.isPropertyAccessExpression(base) && base.name.text === 'payload')
  return isPayload ? { method: callee.name.text, onDb } : undefined
}

/**
 * Whether a Local API call checks access. Payload's Local API skips the check unless the call says
 * `overrideAccess: false`; `payload.db` never checks it.
 */
function accessOf(argument, onDb) {
  if (onDb) return 'bypassed'
  const flag = property(argument, 'overrideAccess')
  if (!flag) return 'bypassed'
  const value = valueOf(flag)
  if (value.kind === ts.SyntaxKind.FalseKeyword) return 'checked'
  return value.kind === ts.SyntaxKind.TrueKeyword ? 'bypassed' : 'depends on a value'
}

/** The first two sentences of the doc comment above the function a node sits in. */
function commentAround(node) {
  let holder = node
  while (holder && !ts.isFunctionDeclaration(holder) && !ts.isVariableStatement(holder)) {
    holder = holder.parent
  }
  if (!holder) return ''
  const sourceFile = holder.getSourceFile()
  const ranges = ts.getLeadingCommentRanges(sourceFile.text, holder.pos) ?? []
  const last = ranges.filter((r) => sourceFile.text.startsWith('/**', r.pos)).pop()
  if (!last) return ''
  const text = sourceFile.text
    .slice(last.pos + 3, last.end - 2)
    .replace(/^\s*\*\s?/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text
    .split(/(?<=\.)\s/)
    .slice(0, 2)
    .join(' ')
}

/** The functions in `entryFile` that start a tool or task: its `handler`, picked by `name` when given. */
function entryHandlers(checker, sourceFile, name) {
  const holders = []
  walkAll(sourceFile, (node) => {
    if (ts.isObjectLiteralExpression(node) && property(node, 'handler')) holders.push(node)
  })
  const named = holders.filter((node) =>
    ['name', 'slug'].some((key) => {
      const p = property(node, key)
      return p && propertyValues(checker, p).includes(name)
    }),
  )
  return (name && named.length > 0 ? named : holders).map((node) => {
    const handler = property(node, 'handler')
    return ts.isMethodDeclaration(handler) ? handler : valueOf(handler)
  })
}

/**
 * The collections a tool or task reaches through Payload's Local API (`find`, `create`, `update`,
 * `delete`, also on `payload.db`), with each operation and whether access is checked. It starts
 * at the `handler` of the object in `entryFile` named `name`, and follows the functions the
 * handler calls, in any file of `src/`: not the whole file. Only calls whose `collection` is a
 * known string count. A call to anything else (a helper) counts when it is given a named
 * constant whose value is one of `knownSlugs`; no operation is known for it. `why` holds the doc
 * comment of the function around a call that says `overrideAccess: true`. A function the config
 * passes in is not followed. Sorted by collection.
 */
export function findCollectionCalls(
  program,
  root,
  entryFile,
  { name, knownSlugs = new Set() } = {},
) {
  const checker = program.getTypeChecker()
  const entry = program.getSourceFile(path.join(root, entryFile))
  if (!entry) return []
  const found = new Map()
  const note = (collection, label, why) => {
    const entryFor = found.get(collection) ?? { operations: new Set(), why: [] }
    if (label) entryFor.operations.add(label)
    if (why && !entryFor.why.some((w) => w.text === why.text && w.operation === why.operation)) {
      entryFor.why.push(why)
    }
    found.set(collection, entryFor)
  }
  const seen = new Set()
  const follow = (callee) => {
    const symbol = checker.getSymbolAtLocation(
      ts.isPropertyAccessExpression(callee) ? callee.name : callee,
    )
    const target =
      symbol && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol
    for (const declaration of target?.declarations ?? []) {
      if (isSource(declaration.getSourceFile().fileName, root)) visit(declaration)
    }
  }
  const onCall = (call) => {
    const payload = payloadMethod(call)
    const argument = call.arguments[0]
    if (payload && argument && ts.isObjectLiteralExpression(argument)) {
      const collection = property(argument, 'collection')
      const access = accessOf(argument, payload.onDb)
      const flag = property(argument, 'overrideAccess')
      const explicit = flag && valueOf(flag).kind === ts.SyntaxKind.TrueKeyword
      const operation = OPERATIONS[payload.method]
      const text = explicit ? commentAround(call) : ''
      const values = collection ? propertyValues(checker, collection) : []
      // A call that takes any collection (the type is all of them) says nothing about one
      const broad = knownSlugs.size > 0 && values.length >= knownSlugs.size / 2
      for (const slug of broad ? [] : values) {
        note(slug, `${operation} (access ${access})`, text ? { operation, text } : undefined)
      }
    } else if (!payload) {
      const named = call.arguments.filter(
        (a) => ts.isIdentifier(a) || ts.isPropertyAccessExpression(a),
      )
      for (const item of named) {
        for (const value of literalValues(checker, item)) if (knownSlugs.has(value)) note(value, '')
      }
    }
    follow(call.expression)
  }
  function visit(node) {
    if (seen.has(node)) return
    seen.add(node)
    walkAll(node, (child) => {
      if (child !== node && ts.isCallExpression(child)) onCall(child)
      else if (child === node && ts.isCallExpression(child)) onCall(child)
    })
  }
  for (const handler of entryHandlers(checker, entry, name)) visit(handler)
  return [...found]
    .map(([collection, { operations, why }]) => ({
      collection,
      operations: [...operations].sort(),
      why: why.sort(
        (a, b) => a.operation.localeCompare(b.operation) || a.text.localeCompare(b.text),
      ),
    }))
    .sort((a, b) => a.collection.localeCompare(b.collection))
}

/** ` (create, read)` after a collection name, or nothing when no operation is known. */
export const operationsSuffix = (operations) =>
  operations.length > 0 ? ` (${operations.join(', ')})` : ''
