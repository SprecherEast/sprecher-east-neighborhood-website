/**
 * The screens reference (#718, decision 0019 §4): one row for every `page.tsx` and `route.ts`
 * under `src/app/(frontend)/`. Read with the TypeScript compiler API (a syntax tree only, no type
 * check), so a route is described by what its own file says. Pure functions apart from
 * `collectRoutes`, which walks the folder.
 */
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

import { cell, code, generatedNotice, table } from '../content-types/render.mjs'

export const ROUTES_ROOT = 'src/app/(frontend)'
const HTTP_METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
const REQUEST_APIS = ['cookies', 'headers', 'draftMode']

/** `events/(index)/category/[category]/page.tsx` becomes `/events/category/[category]`. */
export function routeUrl(relativePath) {
  const segments = relativePath
    .split('/')
    .slice(0, -1)
    .filter((segment) => !/^\(.*\)$/.test(segment))
  return `/${segments.join('/')}`
}

const exportedNames = (sourceFile) => {
  const names = new Map()
  for (const statement of sourceFile.statements) {
    const exported = statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    if (!exported) continue
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) names.set(declaration.name.text, declaration)
      }
    } else if (ts.isFunctionDeclaration(statement) && statement.name) {
      names.set(statement.name.text, statement)
    }
  }
  return names
}

/** Imported local name to the module it comes from. */
const importMap = (sourceFile) => {
  const imports = new Map()
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !statement.importClause) continue
    if (statement.importClause.isTypeOnly) continue
    const from = statement.moduleSpecifier.text
    const { name, namedBindings } = statement.importClause
    if (name) imports.set(name.text, from)
    if (namedBindings && ts.isNamedImports(namedBindings)) {
      for (const element of namedBindings.elements) {
        if (!element.isTypeOnly) imports.set(element.name.text, from)
      }
    }
  }
  return imports
}

const identifiersIn = (node) => {
  const found = new Set()
  const visit = (child) => {
    if (ts.isIdentifier(child)) found.add(child.text)
    ts.forEachChild(child, visit)
  }
  visit(node)
  return found
}

const literalText = (declaration) => {
  const initializer = declaration?.initializer
  if (!initializer) return ''
  if (ts.isStringLiteralLike(initializer) || ts.isNumericLiteral(initializer)) {
    return initializer.text
  }
  if (initializer.kind === ts.SyntaxKind.FalseKeyword) return 'false'
  if (initializer.kind === ts.SyntaxKind.TrueKeyword) return 'true'
  return initializer.getText()
}

function describeMetadata(names, imports, isHandler) {
  if (isHandler) return 'none (no HTML)'
  const key = names.has('generateMetadata')
    ? 'generateMetadata'
    : names.has('metadata') && 'metadata'
  if (!key) return 'inherited from the layout'
  const sources = [...identifiersIn(names.get(key))]
    .map((name) => imports.get(name))
    .filter((from) => from?.startsWith('@/'))
  const unique = [...new Set(sources)].sort()
  return unique.length > 0
    ? `\`${key}\` via ${unique.map((from) => `\`${from}\``).join(', ')}`
    : `\`${key}\` (written in the file)`
}

/** What one route file says about itself; `relativePath` is under `src/app/(frontend)/`. */
export function describeRoute(relativePath, text) {
  const sourceFile = ts.createSourceFile(relativePath, text, ts.ScriptTarget.ES2022, true)
  const names = exportedNames(sourceFile)
  const imports = importMap(sourceFile)
  const isHandler = path.basename(relativePath).startsWith('route.')

  const entries = [...new Set(imports.values())]
    .filter((from) => /^@\/modules\/[^/]+/.test(from))
    .sort()

  const dynamic = literalText(names.get('dynamic'))
  const used = REQUEST_APIS.filter((api) => imports.get(api) === 'next/headers').filter((api) =>
    new RegExp(`\\b${api}\\s*\\(`).test(text),
  )
  let rendering = 'not stated'
  if (dynamic) rendering = `dynamic = ${dynamic}`
  else if (used.length > 0) rendering = `reads ${used.join(', ')}`

  return {
    url: routeUrl(relativePath),
    kind: isHandler ? 'route handler' : 'page',
    file: relativePath,
    entries,
    rendering,
    revalidate: literalText(names.get('revalidate')),
    staticParams: names.has('generateStaticParams'),
    metadata: describeMetadata(names, imports, isHandler),
    methods: isHandler ? HTTP_METHODS.filter((method) => names.has(method)) : [],
  }
}

/** Every page and route handler under the frontend folder, as rows. */
export function collectRoutes(root) {
  const base = path.join(root, ROUTES_ROOT)
  const rows = []
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (/^(page|route)\.tsx?$/.test(entry.name)) {
        const relative = path.relative(base, full).split(path.sep).join('/')
        rows.push(describeRoute(relative, fs.readFileSync(full, 'utf8')))
      }
    }
  }
  walk(base)
  return rows
}

const RENDERING_NOTE = [
  'Each row is what the route file itself says, read from its source: a page can still be',
  'dynamic through something it imports. `Params` says whether `generateStaticParams` builds',
  'the pages ahead of the first visit. Layouts are not listed.',
].join(' ')

export function renderRoutes(rows) {
  const sorted = [...rows].sort(
    (a, b) => a.url.localeCompare(b.url) || a.file.localeCompare(b.file),
  )
  const body = table(
    [
      'URL',
      'Kind',
      'Module entry points',
      'Rendering',
      'Revalidate (s)',
      'Params',
      'Metadata',
      'File',
    ],
    sorted.map((row) => [
      code(row.url),
      row.methods.length > 0 ? `${row.kind} (${row.methods.join(', ')})` : row.kind,
      row.entries.map(code).join(', '),
      cell(row.rendering),
      row.revalidate,
      row.staticParams ? 'prebuilt' : '',
      cell(row.metadata),
      code(`${ROUTES_ROOT}/${row.file}`),
    ]),
  )
  return [
    '# Screens (routes)',
    '',
    generatedNotice('the `src/app/(frontend)/` tree'),
    '',
    `${sorted.length} routes. ${RENDERING_NOTE}`,
    '',
    body,
    '',
  ].join('\n')
}
