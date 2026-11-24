/**
 * Small helpers over the TypeScript syntax tree, shared by the source facts (#1461): which files
 * count as source, the value of an object property, and the string values a type can take.
 */
import ts from 'typescript'

import { rootPrefix } from '../content-types/functions.mjs'

export const isTestFile = (file) =>
  /\.(test|spec|contract)\.[cm]?[jt]sx?$/.test(file) || file.includes('/testing/')

export const isSource = (file, root) =>
  file.startsWith(`${rootPrefix(root)}src/`) && !isTestFile(file) && !file.endsWith('.d.ts')

export const propertyName = (property) =>
  property.name && (ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name))
    ? property.name.text
    : undefined

/** The properties of an object literal that carry a value: `a: 1`, `a` and `a() {}`. */
export const valueProperties = (node) =>
  node.properties.filter(
    (p) =>
      ts.isPropertyAssignment(p) ||
      ts.isShorthandPropertyAssignment(p) ||
      ts.isMethodDeclaration(p),
  )

export const property = (node, name) => valueProperties(node).find((p) => propertyName(p) === name)

/** The expression that holds a property's value: `a: expr` and the shorthand `a` both have one. */
export const valueOf = (p) => (ts.isShorthandPropertyAssignment(p) ? p.name : p.initializer)

export const relativeTo = (root, file) => file.slice(rootPrefix(root).length)

/** The string values an expression can have, from its type: `'a'`, or `'a' | 'b'`. */
export function literalValues(checker, expression) {
  const type = checker.getTypeAtLocation(expression)
  return unionValues(type)
}

/** The same for the value of a property: a shorthand `slug` has the type of the constant it names. */
export function propertyValues(checker, p) {
  if (!ts.isShorthandPropertyAssignment(p)) return literalValues(checker, valueOf(p))
  const symbol = checker.getShorthandAssignmentValueSymbol(p)
  return symbol ? unionValues(checker.getTypeOfSymbolAtLocation(symbol, p.name)) : []
}

export function unionValues(type) {
  const parts = type.isUnion() ? type.types : [type]
  return parts.every((part) => part.isStringLiteral()) ? parts.map((part) => part.value) : []
}

export const walkAll = (node, visit) => {
  visit(node)
  ts.forEachChild(node, (child) => walkAll(child, visit))
}
