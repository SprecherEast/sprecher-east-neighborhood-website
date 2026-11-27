/**
 * Which kit files an examples file may import (#1532). An example is code that runs when the
 * showcase is built, so it may import a kit component only when nothing that component pulls in
 * reaches the Payload admin, the server or the environment. The list is computed from the import
 * graph, never written by hand: a component that gains such an import drops off it by itself.
 */
import { builtinModules } from 'node:module'
import ts from 'typescript'

import { isNameOnly } from './examplesChecks.mjs'
import { isComponentSourceFile } from './sourceProgram.mjs'

const KIT_FOLDER = 'src/platform/ui/'
// Packages that are the CMS, the server or the machine: reaching one makes a file server code
const SERVER_PACKAGE =
  /^(payload($|\/)|@payloadcms\/|@payload-config$|server-only$|next\/(headers|cache|server))/
const BUILTINS = new Set(builtinModules.flatMap((name) => [name, `node:${name}`]))
// Folders that hold the server's own code: a kit file that imports from there is not pure
const SERVER_FOLDER =
  /^src\/(modules|app|endpoints|platform\/(payload|service))\/|^src\/payload\.config\./

/** Whether a package import is server code, so the file that has it may not be an example's import. */
export const isServerPackage = (specifier) =>
  SERVER_PACKAGE.test(specifier) || BUILTINS.has(specifier)

/** What a file imports at runtime (type-only imports leave no trace) and whether it reads `process`. */
export function readImports(text, file) {
  const sourceFile = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TSX,
  )
  const specifiers = []
  let usesProcess = false
  const visit = (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      !(ts.isImportDeclaration(node) && node.importClause?.isTypeOnly) &&
      !(ts.isExportDeclaration(node) && node.isTypeOnly)
    ) {
      specifiers.push(node.moduleSpecifier.text)
    }
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require')) &&
      node.arguments[0] &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      specifiers.push(node.arguments[0].text)
    }
    if (ts.isIdentifier(node) && node.text === 'process' && !isNameOnly(node)) usesProcess = true
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return { specifiers, usesProcess }
}

/**
 * The kit component files an example may import: the reference's component files under the kit
 * (never tests, stories, examples or `testing/`), minus every one whose imports, followed all the
 * way down, reach server code, a server folder or `process`. `resolve(specifier, from)` gives the
 * repository path of a module of ours, or `null` for a package.
 */
export function safeKitFiles({ files, readFile, resolve }) {
  const verdicts = new Map()
  const unsafe = (file, seen = new Set()) => {
    if (verdicts.has(file)) return verdicts.get(file)
    if (seen.has(file)) return false
    seen.add(file)
    const text = readFile(file)
    let result = text === undefined
    if (!result) {
      const { specifiers, usesProcess } = readImports(text, file)
      result =
        usesProcess ||
        specifiers.some((specifier) => {
          const target = resolve(specifier, file)
          if (target === null) return isServerPackage(specifier)
          return target === undefined || SERVER_FOLDER.test(target) || unsafe(target, seen)
        })
    }
    verdicts.set(file, result)
    return result
  }
  return new Set(
    files
      .filter((file) => file.startsWith(KIT_FOLDER) && isComponentSourceFile(file))
      .filter((file) => !unsafe(file)),
  )
}

/** `resolve` for the real repository: the TypeScript compiler's own module resolution. */
export function resolverFor(root, options) {
  const prefix = `${root}/`
  return (specifier, from) => {
    const found = ts.resolveModuleName(specifier, `${prefix}${from}`, options, ts.sys)
      .resolvedModule?.resolvedFileName
    if (!found) return /^(\.|@\/)/.test(specifier) ? undefined : null
    return found.startsWith(prefix) && !found.includes('/node_modules/')
      ? found.slice(prefix.length)
      : null
  }
}
