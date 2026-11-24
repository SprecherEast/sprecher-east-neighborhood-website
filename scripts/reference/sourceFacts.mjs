/**
 * Facts read from the source with the TypeScript compiler (#1461): which file defines a content
 * type, which functions are server actions, and which modules configure a plugin. The type
 * checker resolves constants, so `slug: AGENT_RUNS` is found as `agent-runs`. Pure apart from
 * reading the program it is given.
 */
import path from 'node:path'
import ts from 'typescript'

import { isSource, propertyValues, property, valueOf, walkAll, relativeTo } from './ast.mjs'

/**
 * Slug to the files that define a content type with it: an object literal that has both a `slug`
 * and a `fields` property. Documents with a slug, jobs and tests are not definitions.
 */
export function findDefinitions(program, root) {
  const checker = program.getTypeChecker()
  const found = new Map()
  for (const sourceFile of program.getSourceFiles()) {
    if (!isSource(sourceFile.fileName, root)) continue
    walkAll(sourceFile, (node) => {
      if (!ts.isObjectLiteralExpression(node)) return
      const slug = property(node, 'slug')
      if (!slug || !property(node, 'fields')) return
      for (const value of propertyValues(checker, slug)) {
        const files = found.get(value) ?? new Set()
        files.add(relativeTo(root, sourceFile.fileName))
        found.set(value, files)
      }
    })
  }
  return new Map([...found].map(([slug, files]) => [slug, [...files].sort()]))
}

/** The module or shared area a source file belongs to. */
export function areaOf(file) {
  const [, area, name] = file.split('/')
  if (area === 'modules') return `module \`${name}\``
  if (area === 'platform') return `shared code \`platform/${name}\``
  return `the app folder \`src/${area}\``
}

/** Who owns a content type, from the first file that defines it. */
export function ownerOf(files) {
  const [file] = files
  return file ? { owner: areaOf(file), file } : { owner: 'a plugin or Payload', file: '' }
}

const hasDirective = (body) =>
  body?.statements?.[0] &&
  ts.isExpressionStatement(body.statements[0]) &&
  ts.isStringLiteral(body.statements[0].expression) &&
  body.statements[0].expression.text === 'use server'

const isFunctionLike = (node) =>
  ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)

const isExported = (statement) =>
  statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)

/**
 * Every server action: an exported function of a file that starts with `'use server'`, and a
 * function whose own body starts with it. Each is a POST endpoint of its own.
 */
export function findServerActions(program, root) {
  const found = []
  // Creating the checker binds the files, which sets the parent of every node
  program.getTypeChecker()
  for (const sourceFile of program.getSourceFiles()) {
    if (!isSource(sourceFile.fileName, root)) continue
    const file = relativeTo(root, sourceFile.fileName)
    const add = (name) => found.push({ file, name, area: areaOf(file) })
    const wholeFile = hasDirective(sourceFile)
    for (const statement of sourceFile.statements) {
      if (!wholeFile || !isExported(statement)) continue
      if (ts.isFunctionDeclaration(statement) && statement.name) add(statement.name.text)
      if (ts.isVariableStatement(statement)) {
        for (const d of statement.declarationList.declarations) {
          if (ts.isIdentifier(d.name) && d.initializer && isFunctionLike(d.initializer))
            add(d.name.text)
        }
      }
    }
    if (wholeFile) continue
    walkAll(sourceFile, (node) => {
      if (!isFunctionLike(node) || !hasDirective(node.body)) return
      const holder = ts.isFunctionDeclaration(node) ? node : node.parent
      const name = holder.name ?? (ts.isVariableDeclaration(holder) ? holder.name : undefined)
      if (name && ts.isIdentifier(name)) add(name.text)
    })
  }
  return found.sort((a, b) => a.file.localeCompare(b.file) || a.name.localeCompare(b.name))
}

/** Imported local name to the module it comes from. */
function importSources(sourceFile) {
  const imports = new Map()
  for (const statement of sourceFile.statements) {
    const clause = ts.isImportDeclaration(statement) && statement.importClause
    if (!clause || clause.isTypeOnly) continue
    if (clause.name) imports.set(clause.name.text, statement.moduleSpecifier.text)
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const element of clause.namedBindings.elements) {
        imports.set(element.name.text, statement.moduleSpecifier.text)
      }
    }
  }
  return imports
}

/**
 * Plugin package to the modules whose code is named in the options the plugin is called with,
 * read from the config file: `searchPlugin({ ...searchOptions })` with `searchOptions` imported
 * from `@/modules/news/cms` gives `news`. A plugin called with no module code gives none.
 */
export function findPluginConfigurers(program, root, configFile) {
  const sourceFile = program.getSourceFile(path.join(root, configFile))
  if (!sourceFile) return new Map()
  const imports = importSources(sourceFile)
  const found = new Map()
  walkAll(sourceFile, (node) => {
    if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression)) return
    const from = imports.get(node.expression.text)
    if (!from?.startsWith('@payloadcms/plugin-')) return
    const modules = found.get(from) ?? new Set()
    for (const argument of node.arguments) {
      walkAll(argument, (child) => {
        const source = ts.isIdentifier(child) ? imports.get(child.text) : undefined
        const match = source && /^@\/modules\/([^/]+)/.exec(source)
        if (match) modules.add(match[1])
      })
    }
    found.set(from, modules)
  })
  return new Map(
    [...found].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, [...v].sort()]),
  )
}
