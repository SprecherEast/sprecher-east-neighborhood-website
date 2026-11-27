/**
 * Reads a showcase examples file (#1532) without running it: with the TypeScript compiler, each
 * export is one example. The file is held to what a static export can draw (`examplesChecks.mjs`).
 */
import path from 'node:path'
import ts from 'typescript'

import { exampleAnchor, exampleTitle } from './exampleNames.mjs'
import {
  COMPONENT_NAME,
  EXAMPLE_KEYS,
  FORMAT,
  KIT,
  PACKAGES_ALLOWED,
  PURPOSE_LIMIT,
  checkNode,
  checkServerOnly,
  checkSettings,
  lineOf,
  literal,
  relativeAllowed,
} from './examplesChecks.mjs'
import { isComponentSourceFile } from './sourceProgram.mjs'

export { exampleAnchor, examplesFilesFor, exampleTitle } from './exampleNames.mjs'

/** The text of a node without the indentation it has in the file. */
function dedented(node, sourceFile) {
  const [first, ...rest] = node.getText(sourceFile).split('\n')
  const indent = Math.min(...rest.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length))
  return [first, ...rest.map((line) => line.slice(Number.isFinite(indent) ? indent : 0))].join('\n')
}

/** The top-level declarations of the file that are not exported, by the names they declare. */
function helperDeclarations(sourceFile) {
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

function readExample(statement, declaration, sourceFile, fail, helpers) {
  const name = declaration.name.text
  const failHere = (text) =>
    fail(`${name}${/^(has|must|needs|is|passes|uses|references)/.test(text) ? ' ' : ': '}${text}`)
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

  const purposeNode = entries.get('purpose')?.initializer
  const purpose = purposeNode && ts.isStringLiteralLike(purposeNode) ? purposeNode.text : ''
  if (!purpose.trim()) failHere('has no purpose')
  if (purpose.includes('\n') || purpose.length > PURPOSE_LIMIT) {
    failHere(`the purpose is one line of at most ${PURPOSE_LIMIT} characters`)
  }

  const render = entries.get('render')
  const renderNode = render && (ts.isPropertyAssignment(render) ? render.initializer : render)
  if (
    !renderNode ||
    !(
      ts.isArrowFunction(renderNode) ||
      ts.isFunctionExpression(renderNode) ||
      ts.isMethodDeclaration(renderNode)
    )
  ) {
    failHere('has no render function')
  }

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
  if (
    of !== null &&
    !(names.length > 0 && names.every((n) => typeof n === 'string' && COMPONENT_NAME.test(n)))
  ) {
    failHere('of must be a component name or a list of them')
  }

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

/**
 * The examples of one file, in file order, with the file's `kind`: `client` for `*.examples.client.tsx`
 * (which starts with `'use client'`), `server` otherwise. `file` is the path under the repository.
 * `isComponentFile` says which paths are component files, the only relative imports allowed.
 * Every export must be `defineExample({ purpose, render, settings?, of? })`; anything else fails.
 */
export function readExamples(text, file, { isComponentFile = isComponentSourceFile } = {}) {
  const fail = (message) => {
    throw new Error(`${file}: ${message}`)
  }
  const kind = file.endsWith('.examples.client.tsx') ? 'client' : 'server'
  const clientFile = path.posix.basename(file).replace('.examples.tsx', '.examples.client.tsx')
  const syntax = ts
    .transpileModule(text, {
      fileName: file,
      reportDiagnostics: true,
      compilerOptions: { jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.ES2022 },
    })
    .diagnostics?.find((d) => d.category === ts.DiagnosticCategory.Error)
  if (syntax) fail(`syntax error: ${ts.flattenDiagnosticMessageText(syntax.messageText, ' ')}`)

  const sourceFile = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TSX,
  )
  const first = sourceFile.statements[0]
  const directive =
    first &&
    ts.isExpressionStatement(first) &&
    ts.isStringLiteral(first.expression) &&
    first.expression.text === 'use client'
  if (kind === 'client' && !directive)
    fail("a client examples file needs 'use client' as its first line")
  if (kind === 'server' && directive)
    fail("a server examples file may not start with 'use client'; name it *.examples.client.tsx")

  const helpers = helperDeclarations(sourceFile)
  let formatImported = false
  const examples = []
  for (const statement of sourceFile.statements) {
    const specifier =
      (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) &&
      statement.moduleSpecifier?.text
    if (specifier !== false && specifier !== undefined) {
      const allowed =
        PACKAGES_ALLOWED.has(specifier) ||
        KIT.test(specifier) ||
        (specifier.startsWith('./') && relativeAllowed(specifier, file, isComponentFile))
      if (!allowed) {
        fail(
          `imports ${specifier}; an examples file may import only react, lucide-react, the kit (@/platform/ui/…) and the component files beside it`,
        )
      }
      const named = ts.isImportDeclaration(statement) && statement.importClause?.namedBindings
      if (
        named &&
        ts.isNamedImports(named) &&
        named.elements.some((e) => e.name.text === 'defineExample')
      ) {
        if (!FORMAT.has(specifier)) fail('defineExample comes from ./example')
        formatImported = true
      }
    }
    const exportedName =
      ts.getModifiers(statement)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) &&
      ts.isVariableStatement(statement) &&
      statement.declarationList.declarations[0]?.name.getText(sourceFile)
    // A refusal in an example names it; one in a helper or at the top of the file names the line
    const owner = exportedName ? `${exportedName}${kind === 'server' ? ' ' : ': '}` : ''
    const visit = (node) => {
      checkNode(node, sourceFile, fail, exportedName ? `${exportedName}: ` : '')
      if (kind === 'server')
        checkServerOnly(node, sourceFile, fail, clientFile, owner || 'the file ')
      ts.forEachChild(node, visit)
    }
    visit(statement)
    if (ts.isExportAssignment(statement)) fail('a default export is not a defineExample')
    if (ts.isExportDeclaration(statement) && !statement.moduleSpecifier)
      fail('export lists are not a defineExample')
    if (!ts.getModifiers(statement)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue
    const isVariable = ts.isVariableStatement(statement)
    const declaration = isVariable && statement.declarationList.declarations[0]
    const call = declaration?.initializer
    if (!(call && ts.isCallExpression(call) && call.expression.getText() === 'defineExample')) {
      fail(
        `${declaration?.name?.getText() ?? statement.name?.getText() ?? 'an export'} is not a defineExample(…)`,
      )
    }
    if (!(statement.declarationList.flags & ts.NodeFlags.Const))
      fail(`${declaration.name.getText()} must be a const`)
    if (statement.declarationList.declarations.length > 1) fail('write one example for each export')
    if (!ts.isIdentifier(declaration.name) || !COMPONENT_NAME.test(declaration.name.text)) {
      fail(
        `${declaration.name.getText()} is not a name an example may have (it starts with a capital letter and has only letters and digits)`,
      )
    }
    examples.push(readExample(statement, declaration, sourceFile, fail, helpers))
  }
  if (examples.length > 0 && !formatImported)
    fail('defineExample comes from ./example (or @/platform/ui/example)')
  const seen = new Map()
  for (const { name, anchor } of examples) {
    if (seen.has(anchor)) fail(`${name} has the same link name as ${seen.get(anchor)}`)
    seen.set(anchor, name)
  }
  return examples.map((example) => ({ ...example, kind, file }))
}
