/**
 * Which kit files an examples file may import (#1532). An example is code that runs when the
 * showcase is built, so it may import a kit component only when nothing that component pulls in
 * reaches the Payload admin, the server or the environment. The list is computed from the import
 * graph, never written by hand: a component that gains such an import drops off it by itself.
 */
import fs from 'node:fs'
import { builtinModules } from 'node:module'
import path from 'node:path'
import ts from 'typescript'

import { isNameOnly } from './examplesChecks.mjs'
import { isComponentSourceFile } from './sourceProgram.mjs'

const KIT_FOLDER = 'src/platform/ui/'
// Packages that are the CMS, the server or the machine: reaching one makes a file server code
const SERVER_PACKAGE =
  /^(payload($|\/)|@payloadcms\/|@payload-config$|server-only$|next\/(headers|cache|server|dist\/server))/
const BUILTINS = new Set(builtinModules.flatMap((name) => [name, `node:${name}`]))
// Folders that hold the server's own code: a kit file that imports from there is not pure
const SERVER_FOLDER =
  /^src\/(modules|app|endpoints|platform\/(payload|service))\/|^src\/payload\.config\./

/** Whether a package import is server code, so the file that has it may not be an example's import. */
export const isServerPackage = (specifier) =>
  SERVER_PACKAGE.test(specifier) || BUILTINS.has(specifier)

const GLOBAL_OBJECTS = new Set(['globalThis', 'window', 'self', 'global'])

/** Whether a node reads `process` or another way to the environment: `process`, `globalThis.process`, `import.meta`, `module`, a computed import. */
function reachesEnvironment(node) {
  if (ts.isIdentifier(node))
    return (node.text === 'process' || node.text === 'module') && !isNameOnly(node)
  if (ts.isMetaProperty(node)) return true
  if (ts.isCallExpression(node)) {
    const loads =
      node.expression.kind === ts.SyntaxKind.ImportKeyword ||
      (ts.isIdentifier(node.expression) && node.expression.text === 'require')
    return loads && !(node.arguments[0] && ts.isStringLiteralLike(node.arguments[0]))
  }
  const onGlobal =
    (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) &&
    ts.isIdentifier(node.expression) &&
    GLOBAL_OBJECTS.has(node.expression.text)
  if (!onGlobal) return false
  const key = ts.isPropertyAccessExpression(node) ? node.name : node.argumentExpression
  return key.text === 'process'
}

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
  let usesEnvironment = false
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
    if (reachesEnvironment(node)) usesEnvironment = true
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return { specifiers, usesEnvironment }
}

/**
 * The kit component files an example may import: the reference's component files under the kit
 * (never tests, stories, examples or `testing/`), minus every one whose imports, followed all the
 * way down, reach server code, a server folder or `process`. `resolve(specifier, from)` gives the
 * repository path of a module of ours, or `null` for a package.
 */
export function safeKitFiles({ files, readFile, resolve }) {
  // The graph first: for each file, whether it is unsafe on its own and which files it imports
  const graph = new Map()
  const visit = (file) => {
    if (graph.has(file)) return
    const text = readFile(file)
    const node = { unsafe: text === undefined, imports: [] }
    graph.set(file, node)
    if (text === undefined) return
    const { specifiers, usesEnvironment } = readImports(text, file)
    node.unsafe = usesEnvironment
    for (const specifier of specifiers) {
      const target = resolve(specifier, file)
      if (target === null) node.unsafe ||= isServerPackage(specifier)
      else if (target === undefined || SERVER_FOLDER.test(target)) node.unsafe = true
      else {
        node.imports.push(target)
        visit(target)
      }
    }
  }
  const candidates = files.filter(
    (file) => file.startsWith(KIT_FOLDER) && isComponentSourceFile(file),
  )
  candidates.forEach(visit)
  // Then spread "unsafe" to every importer until nothing changes, so the answer cannot depend on
  // the order of the files or on where a circle is entered
  for (let changed = true; changed; ) {
    changed = false
    for (const node of graph.values()) {
      if (!node.unsafe && node.imports.some((target) => graph.get(target).unsafe)) {
        node.unsafe = true
        changed = true
      }
    }
  }
  return new Set(candidates.filter((file) => !graph.get(file).unsafe))
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

/**
 * The safe kit files of the repository at `root`, read from disk: the one policy the generator and
 * the examples test both judge an examples file by.
 */
export function safeKitFilesIn(root) {
  const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile)
  const options = ts.parseJsonConfigFileContent(config.config, ts.sys, root).options
  const folder = path.join(root, KIT_FOLDER)
  const names = fs.existsSync(folder)
    ? fs.readdirSync(folder, { recursive: true, encoding: 'utf8' })
    : []
  const files = names.map((file) => `${KIT_FOLDER}${file.split(path.sep).join('/')}`)
  return safeKitFiles({
    files,
    readFile: (file) =>
      fs.existsSync(path.join(root, file))
        ? fs.readFileSync(path.join(root, file), 'utf8')
        : undefined,
    resolve: resolverFor(root, options),
  })
}
