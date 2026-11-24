/**
 * Functions the config passes into a task's own code (#1461): the keepers handed to the
 * confirmation retention task are written in other modules and called from the task. They are
 * found where `payload.config.ts` calls a function written in the task's file, from the functions
 * named in the call's arguments.
 */
import path from 'node:path'
import ts from 'typescript'

import { isSource, walkAll } from './ast.mjs'

/** The declarations a name in the config stands for, through the re-exports that lead to them. */
function declarationsOf(checker, node) {
  const symbol = checker.getSymbolAtLocation(node)
  const target =
    symbol && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol
  return target?.declarations ?? []
}

/** The function a declaration is, or the function a `const` holds; nothing for anything else. */
function functionOf(declaration) {
  if (ts.isFunctionDeclaration(declaration)) return declaration
  const value = ts.isVariableDeclaration(declaration) ? declaration.initializer : undefined
  return value && (ts.isArrowFunction(value) || ts.isFunctionExpression(value)) ? value : undefined
}

/**
 * The functions named in the arguments of calls in `configFile` to a function written in
 * `entryFile`, where they are in `src/`. Sorted by file, then position, so the result is stable.
 */
export function injectedFunctions(program, root, entryFile, configFile) {
  const checker = program.getTypeChecker()
  const config = program.getSourceFile(path.join(root, configFile))
  if (!config) return []
  const entryPath = path.join(root, entryFile)
  const found = new Set()
  walkAll(config, (node) => {
    if (!ts.isCallExpression(node)) return
    const callee = declarationsOf(checker, node.expression)
    if (!callee.some((d) => d.getSourceFile().fileName === entryPath)) return
    for (const argument of node.arguments) {
      walkAll(argument, (child) => {
        if (!ts.isIdentifier(child)) return
        for (const declaration of declarationsOf(checker, child)) {
          const fn = functionOf(declaration)
          if (fn && isSource(declaration.getSourceFile().fileName, root)) found.add(fn)
        }
      })
    }
  })
  return [...found].sort(
    (a, b) => a.getSourceFile().fileName.localeCompare(b.getSourceFile().fileName) || a.pos - b.pos,
  )
}
