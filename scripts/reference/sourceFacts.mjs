/**
 * Facts read from the source with the TypeScript compiler (#1461): which file defines a content
 * type, and which collections a piece of code reaches through Payload's Local API. The type
 * checker resolves constants, so `slug: AGENT_RUNS` is found as `agent-runs`. Pure apart from
 * reading the program it is given.
 */
import path from 'node:path'
import ts from 'typescript'

import { rootPrefix } from '../content-types/functions.mjs'

const isTestFile = (file) =>
  /\.(test|spec|contract)\.[cm]?[jt]sx?$/.test(file) || file.includes('/testing/')

const propertyName = (property) =>
  ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)
    ? property.name.text
    : undefined

const relativeTo = (root, file) => file.slice(rootPrefix(root).length)

/** The string values an expression can have, from its type: `'a'`, or `'a' | 'b'`. */
function literalValues(checker, expression) {
  const type = checker.getTypeAtLocation(expression)
  const parts = type.isUnion() ? type.types : [type]
  return parts.every((part) => part.isStringLiteral()) ? parts.map((part) => part.value) : []
}

/**
 * Slug to the files that define a content type with it: an object literal that has both a `slug`
 * and a `fields` property. Documents with a slug, jobs and tests are not definitions.
 */
export function findDefinitions(program, root) {
  const checker = program.getTypeChecker()
  const prefix = rootPrefix(root)
  const found = new Map()
  for (const sourceFile of program.getSourceFiles()) {
    const file = sourceFile.fileName
    if (!file.startsWith(`${prefix}src/`) || isTestFile(file)) continue
    const visit = (node) => {
      if (ts.isObjectLiteralExpression(node)) {
        const props = node.properties.filter(ts.isPropertyAssignment)
        const slug = props.find((p) => propertyName(p) === 'slug')
        if (slug && props.some((p) => propertyName(p) === 'fields')) {
          for (const value of literalValues(checker, slug.initializer)) {
            const files = found.get(value) ?? new Set()
            files.add(relativeTo(root, file))
            found.set(value, files)
          }
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(sourceFile)
  }
  return new Map([...found].map(([slug, files]) => [slug, [...files].sort()]))
}

/** Who owns a content type, from the first file that defines it. */
export function ownerOf(files) {
  const [file] = files
  if (!file) return { owner: 'a plugin or Payload', file: '' }
  const [, area, name] = file.split('/')
  if (area === 'modules') return { owner: `module \`${name}\``, file }
  return { owner: `shared code \`platform/${name}\``, file }
}

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

/** `payload.find(…)` or `req.payload.db.deleteMany(…)`: the method name, or undefined. */
function payloadMethod(call) {
  const callee = call.expression
  if (!ts.isPropertyAccessExpression(callee) || !(callee.name.text in OPERATIONS)) return undefined
  const owner = callee.expression
  const base =
    ts.isPropertyAccessExpression(owner) && owner.name.text === 'db' ? owner.expression : owner
  const isPayload =
    (ts.isIdentifier(base) && base.text === 'payload') ||
    (ts.isPropertyAccessExpression(base) && base.name.text === 'payload')
  return isPayload ? callee.name.text : undefined
}

/** The source files an entry file imports with a relative path, however deep. */
function reachable(program, entry) {
  const seen = new Set()
  const queue = [entry]
  while (queue.length > 0) {
    const sourceFile = queue.pop()
    if (seen.has(sourceFile.fileName)) continue
    seen.add(sourceFile.fileName)
    for (const statement of sourceFile.statements) {
      if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue
      const from = statement.moduleSpecifier
      if (!from || !ts.isStringLiteralLike(from) || !from.text.startsWith('.')) continue
      const target = ts.resolveModuleName(
        from.text,
        sourceFile.fileName,
        program.getCompilerOptions(),
        ts.sys,
      ).resolvedModule?.resolvedFileName
      const next = target && program.getSourceFile(target)
      if (next && !isTestFile(next.fileName)) queue.push(next)
    }
  }
  return [...seen].map((name) => program.getSourceFile(name))
}

/**
 * The collections an entry file reaches through Payload's Local API (`find`, `create`, `update`,
 * `delete`, also on `payload.db`), with the operations, in the file and in what it imports by a
 * relative path. Only calls whose `collection` is a known string count. A call to anything else
 * (a helper) counts when it is given a named constant whose value is one of `knownSlugs`; no
 * operation is known for it. Sorted by collection.
 */
export function findCollectionCalls(program, root, entryFile, knownSlugs = new Set()) {
  const checker = program.getTypeChecker()
  const entry = program.getSourceFile(path.join(root, entryFile))
  if (!entry) return []
  const found = new Map()
  for (const sourceFile of reachable(program, entry)) {
    const note = (collection, operation) => {
      const operations = found.get(collection) ?? new Set()
      if (operation) operations.add(operation)
      found.set(collection, operations)
    }
    const visit = (node) => {
      if (ts.isCallExpression(node)) {
        const method = payloadMethod(node)
        const argument = node.arguments[0]
        if (method && argument && ts.isObjectLiteralExpression(argument)) {
          const property = argument.properties
            .filter(ts.isPropertyAssignment)
            .find((p) => propertyName(p) === 'collection')
          const values = property ? literalValues(checker, property.initializer) : []
          for (const collection of values) note(collection, OPERATIONS[method])
        } else if (!method) {
          const named = node.arguments.filter(
            (a) => ts.isIdentifier(a) || ts.isPropertyAccessExpression(a),
          )
          for (const name of named) {
            for (const value of literalValues(checker, name)) {
              if (knownSlugs.has(value)) note(value, '')
            }
          }
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(sourceFile)
  }
  return [...found]
    .map(([collection, operations]) => ({ collection, operations: [...operations].sort() }))
    .sort((a, b) => a.collection.localeCompare(b.collection))
}

/** ` (create, read)` after a collection name, or nothing when no operation is known. */
export const operationsSuffix = (operations) =>
  operations.length > 0 ? ` (${operations.join(', ')})` : ''
