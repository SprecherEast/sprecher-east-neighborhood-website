/** The functions named `name` in a file: a declaration, or a `const` holding an arrow or function. */
function namedFunctions(sourceFile, name) {
  const found = []
  walkAll(sourceFile, (node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found.push(node)
    const holds =
      ts.isVariableDeclaration(node) &&
      node.name.text === name &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
    if (holds) found.push(node.initializer)
  })
  return found
}

/**
 * The collections a tool or task reaches through Payload's Local API (#1461), found by following
 * the calls from its handler in the source, with each operation and whether access is checked.
 */
import path from 'node:path'
import ts from 'typescript'

import { commentAround } from './callComments.mjs'
import { isSource, literalValues, property, propertyValues, valueOf, walkAll } from './ast.mjs'
import { injectedFunctions } from './injectedFunctions.mjs'

const OPERATIONS = {
  find: 'read',
  findByID: 'read',
  findOne: 'read',
  count: 'read',
  findVersions: 'read',
  findVersionByID: 'read',
  findGlobal: 'read',
  findGlobalVersions: 'read',
  create: 'create',
  duplicate: 'create',
  update: 'update',
  updateOne: 'update',
  updateMany: 'update',
  updateGlobal: 'update',
  restoreVersion: 'update',
  delete: 'delete',
  deleteOne: 'delete',
  deleteMany: 'delete',
}

/** The calls it counts, for the pages to list. */
export const COUNTED_CALLS = Object.keys(OPERATIONS)

/** A call on a global names it with `slug`; every other call names a collection with `collection`. */
const GLOBAL_CALLS = new Set(['findGlobal', 'findGlobalVersions', 'updateGlobal'])

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
 * handler calls, in any file of `src/`: not the whole file. With `hook`, it starts at the
 * function of that name in `entryFile` instead (a schedule hook, which has no `handler`). With
 * `configFile`, the functions that file passes to a function of `entryFile` are followed too. Only calls whose `collection` is a
 * known string count. A call to anything else (a helper) counts when it is given a named
 * constant whose value is one of `knownSlugs`; no operation is known for it. `why` holds the doc
 * comment of the function around a call that says `overrideAccess: true`. A function the config
 * passes in any other way is not followed, and neither are the hooks a write sets off. Sorted by collection.
 */
export function findCollectionCalls(
  program,
  root,
  entryFile,
  { name, hook, configFile, knownSlugs = new Set() } = {},
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
  const seen = new Map()
  /** The known collections an argument stands for: a named constant, or a parameter bound above. */
  const argumentSlugs = (argument, bindings) => {
    if (ts.isIdentifier(argument) && bindings.has(argument.text)) return bindings.get(argument.text)
    if (!ts.isIdentifier(argument) && !ts.isPropertyAccessExpression(argument)) return []
    const values = literalValues(checker, argument)
    const broad = knownSlugs.size > 0 && values.length > 1 && values.length >= knownSlugs.size / 2
    return broad ? [] : values.filter((value) => knownSlugs.has(value))
  }
  /** The parameters of a function a call goes to, bound to the collections the call passes in. */
  const bindParameters = (declaration, call, bindings) => {
    const fn = ts.isVariableDeclaration(declaration) ? declaration.initializer : declaration
    const bound = new Map()
    for (const [i, parameter] of (fn?.parameters ?? []).entries()) {
      const slugs = call.arguments[i] ? argumentSlugs(call.arguments[i], bindings) : []
      if (slugs.length > 0 && ts.isIdentifier(parameter.name)) bound.set(parameter.name.text, slugs)
    }
    return bound
  }
  const follow = (call, bindings) => {
    const callee = call.expression
    const symbol = checker.getSymbolAtLocation(
      ts.isPropertyAccessExpression(callee) ? callee.name : callee,
    )
    const target =
      symbol && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol
    for (const declaration of target?.declarations ?? []) {
      if (isSource(declaration.getSourceFile().fileName, root)) {
        visit(declaration, bindParameters(declaration, call, bindings))
      }
    }
  }
  const onPayloadCall = (call, payload, bindings) => {
    const argument = call.arguments[0]
    const collection = property(argument, GLOBAL_CALLS.has(payload.method) ? 'slug' : 'collection')
    const access = accessOf(argument, payload.onDb)
    const operation = OPERATIONS[payload.method]
    const text = access === 'bypassed' ? commentAround(call) : ''
    const named = collection && ts.isIdentifier(valueOf(collection)) ? valueOf(collection).text : ''
    const values = bindings.get(named) ?? (collection ? propertyValues(checker, collection) : [])
    // A call that takes any collection (the type is all of them) says nothing about one
    const broad =
      !bindings.has(named) &&
      knownSlugs.size > 0 &&
      values.length > 1 &&
      values.length >= knownSlugs.size / 2
    for (const slug of broad ? [] : values) {
      note(slug, `${operation} (access ${access})`, text ? { operation, text } : undefined)
    }
  }
  const onCall = (call, bindings) => {
    const payload = payloadMethod(call)
    if (payload && call.arguments[0] && ts.isObjectLiteralExpression(call.arguments[0])) {
      onPayloadCall(call, payload, bindings)
    } else if (!payload) {
      for (const argument of call.arguments) {
        for (const value of argumentSlugs(argument, bindings)) note(value, '')
      }
    }
    follow(call, bindings)
  }
  function visit(node, bindings = new Map()) {
    const key = JSON.stringify([...bindings])
    const keys = seen.get(node) ?? new Set()
    if (keys.has(key)) return
    seen.set(node, keys.add(key))
    walkAll(node, (child) => {
      if (ts.isCallExpression(child)) onCall(child, bindings)
    })
  }
  const starts = hook
    ? namedFunctions(entry, hook)
    : [
        ...entryHandlers(checker, entry, name),
        ...(configFile ? injectedFunctions(program, root, entryFile, configFile) : []),
      ]
  for (const start of starts) visit(start)
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

/** ` (create, read)` after a collection name, or says no operation is shown for it. */
export const operationsSuffix = (operations) =>
  operations.length > 0 ? ` (${operations.join(', ')})` : ' (operation not shown)'
