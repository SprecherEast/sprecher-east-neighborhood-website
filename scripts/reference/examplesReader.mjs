/**
 * Reads a showcase examples file (#1532) without running it: with the TypeScript compiler, each
 * export is one example. The file is held to what a static export can draw (`examplesImports.mjs`,
 * `examplesMarkup.mjs`, `examplesChecks.mjs`).
 */
import path from 'node:path'
import ts from 'typescript'

import { COMPONENT_NAME, checkNode, checkServerOnly } from './examplesChecks.mjs'
import { helperDeclarations, readExample } from './examplesExample.mjs'
import { checkImport } from './examplesImports.mjs'

export { exampleAnchor, examplesFilesFor, exampleTitle } from './exampleNames.mjs'

const isExported = (statement) =>
  ts.getModifiers(statement)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)

/** Fails on a syntax error, then gives the parsed file. */
function parse(text, file, fail) {
  const syntax = ts
    .transpileModule(text, {
      fileName: file,
      reportDiagnostics: true,
      compilerOptions: { jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.ES2022 },
    })
    .diagnostics?.find((d) => d.category === ts.DiagnosticCategory.Error)
  if (syntax) fail(`syntax error: ${ts.flattenDiagnosticMessageText(syntax.messageText, ' ')}`)
  return ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX)
}

/** A client file starts with 'use client', a server file does not. */
function checkDirective(sourceFile, kind, fail) {
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
}

/** Every refusal that applies inside a statement: names, markup, and (in a server file) handlers. */
function checkInside(statement, sourceFile, fail, kind, file) {
  const clientFile = path.posix.basename(file).replace('.examples.tsx', '.examples.client.tsx')
  const exportedName =
    isExported(statement) &&
    ts.isVariableStatement(statement) &&
    statement.declarationList.declarations[0]?.name.getText(sourceFile)
  // A refusal in an example names it; one in a helper or at the top of the file names the line
  const owner = exportedName ? `${exportedName}${kind === 'server' ? ' ' : ': '}` : ''
  const visit = (node) => {
    checkNode(node, sourceFile, fail, exportedName ? `${exportedName}: ` : '')
    if (kind === 'server') checkServerOnly(node, sourceFile, fail, clientFile, owner || 'the file ')
    ts.forEachChild(node, visit)
  }
  visit(statement)
}

/** Fails on an export that is not a `const X = defineExample(…)`. */
function checkExport(statement, fail) {
  if (ts.isExportDeclaration(statement) && statement.moduleSpecifier) {
    fail('re-exports are not a defineExample')
  }
  if (ts.isExportAssignment(statement)) fail('a default export is not a defineExample')
  if (ts.isExportDeclaration(statement)) fail('export lists are not a defineExample')
  if (!isExported(statement)) return null
  const declaration = ts.isVariableStatement(statement) && statement.declarationList.declarations[0]
  const call = declaration?.initializer
  if (!(call && ts.isCallExpression(call) && call.expression.getText() === 'defineExample')) {
    const name = declaration?.name?.getText() ?? statement.name?.getText() ?? 'an export'
    fail(`${name} is not a defineExample(…)`)
  }
  if (!(statement.declarationList.flags & ts.NodeFlags.Const))
    fail(`${declaration.name.getText()} must be a const`)
  if (statement.declarationList.declarations.length > 1) fail('write one example for each export')
  if (!ts.isIdentifier(declaration.name) || !COMPONENT_NAME.test(declaration.name.text)) {
    fail(
      `${declaration.name.getText()} is not a name an example may have (it starts with a capital letter and has only letters and digits)`,
    )
  }
  return declaration
}

/**
 * The examples of one file, in file order, with the file's `kind`: `client` for `*.examples.client.tsx`
 * (which starts with `'use client'`), `server` otherwise. `file` is the path under the repository.
 * `isKitFile` is the safe list (`kitFiles.mjs`; empty by default): the only kit files an example may
 * import, by `@/platform/ui/…` or by a relative path.
 * Every export must be `defineExample({ purpose, render, settings?, of? })`; anything else fails.
 * @param {string} text
 * @param {string} file
 * @param {{ isKitFile?: (file: string) => boolean }} [policy]
 */
export function readExamples(text, file, { isKitFile = () => false } = {}) {
  const fail = (message) => {
    throw new Error(`${file}: ${message}`)
  }
  const kind = file.endsWith('.examples.client.tsx') ? 'client' : 'server'
  const sourceFile = parse(text, file, fail)
  checkDirective(sourceFile, kind, fail)
  const helpers = helperDeclarations(sourceFile)
  let formatImported = false
  const examples = []
  for (const statement of sourceFile.statements) {
    formatImported = checkImport(statement, file, isKitFile, fail) || formatImported
    checkInside(statement, sourceFile, fail, kind, file)
    const declaration = checkExport(statement, fail)
    if (declaration) examples.push(readExample(statement, declaration, sourceFile, fail, helpers))
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
