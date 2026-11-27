/**
 * The showcase index (#1532, epic #1528): one JSON file with, for every shared component, what the
 * showcase pages, the landing page and the coverage check need: its group, description, props,
 * variants, where it is used and its examples. The examples are read, never copied: each
 * `*.examples.tsx` file beside a component is parsed with the TypeScript compiler (no code runs),
 * and the source shown for an example is the text of its own `render` function.
 */
import path from 'node:path'
import ts from 'typescript'

import { generatedNotice } from '../content-types/render.mjs'

const PURPOSE_LIMIT = 120
const SETTING_KINDS = ['boolean', 'choice', 'text']
// What examples must not reach: the CMS, the modules, server-only code. They are drawn by a static
// export with no database, secret or network (#1530)
const FORBIDDEN_IMPORT =
  /^(payload|@payloadcms\/.*|@payload-config|@\/modules\/.*|@\/platform\/payload(\/.*)?|@\/endpoints\/.*|next\/headers|next\/server|server-only)$/

/** The words of an export name: `SecondTabOpen` is "Second tab open". */
export function exampleTitle(name) {
  const words = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** The link name of an example (the part after the `#`): `SecondTabOpen` is `second-tab-open`. */
export const exampleAnchor = (name) =>
  name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')

/** The examples file beside a component file: `Tabs.client.tsx` has `Tabs.examples.tsx`. */
export const examplesFileFor = (componentFile) =>
  componentFile.replace(/(\.client)?\.tsx$/, '.examples.tsx')

/** The value of a literal in the source: text, number, boolean, list or object of those. */
function literal(node) {
  if (ts.isStringLiteralLike(node)) return node.text
  if (ts.isNumericLiteral(node)) return Number(node.text)
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal)
  if (ts.isObjectLiteralExpression(node)) {
    return Object.fromEntries(
      node.properties.map((p) => {
        if (
          !ts.isPropertyAssignment(p) ||
          !(ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))
        ) {
          throw new Error('not a literal')
        }
        return [p.name.text, literal(p.initializer)]
      }),
    )
  }
  throw new Error('not a literal')
}

/** The text of a node without the indentation it has in the file. */
function dedented(node, sourceFile) {
  const [first, ...rest] = node.getText(sourceFile).split('\n')
  const indent = Math.min(...rest.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length))
  return [first, ...rest.map((line) => line.slice(Number.isFinite(indent) ? indent : 0))].join('\n')
}

function checkSettings(fail, settings) {
  for (const [key, setting] of Object.entries(settings)) {
    const kind = setting?.kind
    if (!SETTING_KINDS.includes(kind)) fail(`setting ${key} has kind ${kind}`)
    const ofKind = { boolean: 'boolean', text: 'string', choice: 'string' }[kind]
    if (typeof setting.default !== ofKind) fail(`setting ${key} needs a default of its kind`)
    if (kind === 'choice' && !(setting.options ?? []).includes(setting.default)) {
      fail(`setting ${key} has a default that is not one of its options`)
    }
  }
}

/** What an example's own code does that a static export could not: reads settings, calls out. */
function forbiddenUse(node) {
  let found = null
  const visit = (n) => {
    if (found) return
    if (ts.isPropertyAccessExpression(n) && n.getText() === 'process.env')
      found = 'reads process.env'
    else if (ts.isCallExpression(n) && n.expression.getText() === 'fetch') found = 'calls fetch'
    else ts.forEachChild(n, visit)
  }
  visit(node)
  return found
}

function readExample(statement, declaration, sourceFile, fail) {
  const name = declaration.name.text
  const call = declaration.initializer
  const config = call.arguments[0]
  const property = (key) =>
    config?.properties?.find((p) => p.name && ts.isIdentifier(p.name) && p.name.text === key)
  const use = forbiddenUse(call)
  if (use) fail(`${name} ${use}`)

  const purposeNode = property('purpose')?.initializer
  const purpose = purposeNode && ts.isStringLiteralLike(purposeNode) ? purposeNode.text : ''
  if (!purpose) fail(`${name} has no purpose`)
  if (purpose.includes('\n') || purpose.length > PURPOSE_LIMIT) {
    fail(`${name}: the purpose is one line of at most ${PURPOSE_LIMIT} characters`)
  }

  const render = property('render')
  const renderNode = render && (ts.isPropertyAssignment(render) ? render.initializer : render)
  const isFunction =
    renderNode &&
    (ts.isArrowFunction(renderNode) ||
      ts.isFunctionExpression(renderNode) ||
      ts.isMethodDeclaration(renderNode))
  if (!isFunction) fail(`${name} has no render function`)

  let settings = {}
  const settingsNode = property('settings')?.initializer
  if (settingsNode) {
    try {
      settings = literal(settingsNode)
    } catch {
      fail(`${name}: settings must be plain data (text, numbers, true, false, lists and objects)`)
    }
    checkSettings((text) => fail(`${name}: ${text}`), settings)
  }

  let of = null
  const ofNode = property('of')?.initializer
  if (ofNode) of = literal(ofNode)

  return {
    name,
    title: exampleTitle(name),
    anchor: exampleAnchor(name),
    purpose,
    of,
    settings,
    source: dedented(renderNode, sourceFile),
    line: sourceFile.getLineAndCharacterOfPosition(statement.getStart(sourceFile)).line + 1,
  }
}

/**
 * The configurations of one examples file, in file order. `file` only names the file in errors.
 * Every export must be `defineExample({ purpose, render, settings?, of? })`; anything else fails.
 */
export function readExamples(text, file) {
  const fail = (message) => {
    throw new Error(`${file}: ${message}`)
  }
  const sourceFile = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TSX,
  )
  const examples = []
  for (const statement of sourceFile.statements) {
    const specifier =
      (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) &&
      statement.moduleSpecifier?.text
    if (specifier && FORBIDDEN_IMPORT.test(specifier)) {
      fail(`examples may not import the CMS, a module or server-only code (${specifier})`)
    }
    if (ts.isExportAssignment(statement)) fail('a default export is not a defineExample')
    if (ts.isExportDeclaration(statement)) fail('export lists are not a defineExample')
    const exported = ts.getModifiers(statement)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    if (!exported) continue
    const declaration =
      ts.isVariableStatement(statement) && statement.declarationList.declarations[0]
    const call = declaration?.initializer
    if (!(call && ts.isCallExpression(call) && call.expression.getText() === 'defineExample')) {
      const name = declaration?.name?.getText() ?? statement.name?.getText() ?? 'an export'
      fail(`${name} is not a defineExample(…)`)
    }
    examples.push(readExample(statement, declaration, sourceFile, fail))
  }
  const seen = new Map()
  for (const { name, anchor } of examples) {
    if (seen.has(anchor)) fail(`${name} has the same link name as ${seen.get(anchor)}`)
    seen.set(anchor, name)
  }
  return examples
}

/**
 * The index: `groups` are the reference's groups with their described components, `users` maps a
 * component name to the files that import it, `readFile` gives a file's text or `undefined`, and
 * `exampleFiles` lists every `*.examples.tsx` file in the kit, so one beside no component fails.
 */
export function buildShowcaseIndex({ groups, users, readFile, exampleFiles }) {
  const all = groups.flatMap((group) => group.components.map((component) => ({ group, component })))
  const files = [...new Set(all.map(({ component }) => component.file))]
  const claimed = new Set(files.map(examplesFileFor))
  for (const file of exampleFiles) {
    if (!claimed.has(file)) throw new Error(`${file} is beside no component file`)
  }

  const byFile = new Map()
  for (const file of files) {
    const examplesFile = examplesFileFor(file)
    const text = readFile(examplesFile)
    if (text === undefined) continue
    const names = all
      .filter(({ component }) => component.file === file)
      .map(({ component }) => component.name)
    const stem = path.posix.basename(file).replace(/(\.client)?\.tsx$/, '')
    const primary = names.includes(stem) ? stem : names[0]
    const items = readExamples(text, examplesFile).map((example) => {
      const named = [example.of ?? primary].flat()
      for (const name of named) {
        if (!names.includes(name)) {
          throw new Error(
            `${examplesFile}: ${example.name} names ${name}, which ${path.posix.basename(file)} does not export`,
          )
        }
      }
      return { example, named }
    })
    byFile.set(file, { examplesFile, items })
  }

  const components = all.map(({ group, component }) => {
    const found = byFile.get(component.file)
    const items = found?.items.filter(({ named }) => named.includes(component.name)) ?? []
    return {
      name: component.name,
      group: group.slug,
      groupTitle: group.title,
      file: component.file,
      description: component.description,
      props: component.props,
      inheritedProps: component.inherited,
      parts: component.parts,
      usedBy: {
        count: (users.get(component.name) ?? []).length,
        files: users.get(component.name) ?? [],
      },
      examples:
        items.length > 0
          ? { file: found.examplesFile, items: items.map(({ example }) => example) }
          : null,
    }
  })
  const missing = components.filter((c) => c.examples === null).map((c) => c.name)
  return {
    generated: generatedNotice(
      'the TypeScript types and imports under `src/` and the `*.examples.tsx` files beside the components',
    ),
    coverage: {
      total: components.length,
      withExamples: components.length - missing.length,
      missing,
    },
    components,
  }
}

/** The index as the text of `docs/reference/showcase-index.json` (the generator formats it). */
export const renderShowcaseIndex = (index) => `${JSON.stringify(index, null, 2)}\n`
