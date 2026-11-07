/**
 * The shared-components reference (#718, decision 0019 §4). Uses the TypeScript compiler API (the
 * type checker the project already runs): for each exported component it reads the props type the
 * compiler resolves, so a changed prop changes the page. Where a component is used comes from the
 * import declarations of the whole program, followed through barrel files to the original symbol.
 */
import path from 'node:path'
import ts from 'typescript'

import { cell, code, generatedNotice, table } from '../content-types/render.mjs'
import { ROUTES_ROOT, routeUrl } from './routes.mjs'

const TYPE_LIMIT = 160
const TYPE_FLAGS =
  ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope
const inPackage = (file) => file.includes('/node_modules/')
const isTestFile = (file) => /\.(test|spec)\.tsx?$/.test(file) || file.includes('/testing/')
const relative = (root, file) => path.relative(root, file).split(path.sep).join('/')

/** Names of the variants a `cva(…, { variants: { name: {…} } })` call in the file defines. */
function cvaVariantNames(sourceFile) {
  const names = new Set()
  const visit = (node) => {
    if (ts.isCallExpression(node) && node.expression.getText(sourceFile) === 'cva') {
      const config = node.arguments[1]
      if (config && ts.isObjectLiteralExpression(config)) {
        const variants = config.properties.find(
          (p) => ts.isPropertyAssignment(p) && p.name.getText(sourceFile) === 'variants',
        )
        if (variants && ts.isObjectLiteralExpression(variants.initializer)) {
          for (const p of variants.initializer.properties) {
            if (p.name) names.add(p.name.getText(sourceFile))
          }
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return names
}

const docOf = (checker, symbol) =>
  ts.displayPartsToString(symbol.getDocumentationComment(checker)).replace(/\s+/g, ' ').trim()

function shownType(checker, type, optional, location) {
  const text = checker.typeToString(
    optional ? checker.getNonNullableType(type) : type,
    location,
    TYPE_FLAGS,
  )
  return text.length > TYPE_LIMIT ? `${text.slice(0, TYPE_LIMIT - 1)}…` : text
}

/** The props of one component type: the first parameter of its call signature. */
function describeProps(checker, type, location, variantNames) {
  const parameter = type.getCallSignatures()[0]?.parameters[0]
  if (!parameter) return { props: [], inherited: 0 }
  const propsType = checker.getTypeOfSymbolAtLocation(parameter, location)
  const props = []
  let inherited = 0
  for (const symbol of checker.getPropertiesOfType(propsType)) {
    const declarations = symbol.declarations ?? []
    const files = declarations.map((d) => d.getSourceFile().fileName)
    const optional = (symbol.flags & ts.SymbolFlags.Optional) !== 0
    const fromVariantHelper = files.some((f) => f.includes('/class-variance-authority/'))
    if (!fromVariantHelper && files.length > 0 && files.every(inPackage)) {
      inherited += 1
      continue
    }
    props.push({
      name: symbol.getName(),
      type: shownType(
        checker,
        checker.getTypeOfSymbolAtLocation(symbol, location),
        optional,
        location,
      ),
      optional,
      doc: docOf(checker, symbol),
      variant: fromVariantHelper || variantNames.has(symbol.getName()),
    })
  }
  return { props, inherited }
}

const isComponentName = (name) => /^[A-Z][A-Za-z0-9]*$/.test(name) && name !== name.toUpperCase()

/** Every exported component of the given files (absolute paths or paths under `root`). */
export function describeComponents(program, root, files) {
  const checker = program.getTypeChecker()
  const found = []
  for (const file of files) {
    const sourceFile = program.getSourceFile(path.resolve(root, file))
    const moduleSymbol = sourceFile && checker.getSymbolAtLocation(sourceFile)
    if (!moduleSymbol) continue
    const variantNames = cvaVariantNames(sourceFile)
    for (const exported of checker.getExportsOfModule(moduleSymbol)) {
      const name = exported.getName()
      if (!isComponentName(name) || !(exported.flags & ts.SymbolFlags.Value)) continue
      const type = checker.getTypeOfSymbolAtLocation(exported, sourceFile)
      if (type.getCallSignatures().length === 0) continue
      // A React context object is callable in the types but is not a component
      if (type.getProperty('Provider')) continue
      const parts = checker
        .getPropertiesOfType(type)
        .filter((p) => isComponentName(p.getName()))
        .map((p) => ({ p, partType: checker.getTypeOfSymbolAtLocation(p, sourceFile) }))
        .filter(({ partType }) => partType.getCallSignatures().length > 0)
        .map(({ p, partType }) => ({
          name: `${name}.${p.getName()}`,
          description: docOf(checker, p),
          ...describeProps(checker, partType, sourceFile, variantNames),
        }))
      const target =
        exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported
      found.push({
        name,
        file: relative(root, sourceFile.fileName),
        description: docOf(checker, exported),
        ...describeProps(checker, type, sourceFile, variantNames),
        parts,
        symbol: target,
      })
    }
  }
  return found
}

/** For each component name, the files in `src/` that import it (barrel files followed), sorted. */
export function findUsers(program, root, components) {
  const checker = program.getTypeChecker()
  const byName = new Map(components.map((c) => [c.symbol, c.name]))
  const users = new Map(components.map((c) => [c.name, new Set()]))
  const ownFile = new Map(components.map((c) => [c.name, c.file]))
  for (const sourceFile of program.getSourceFiles()) {
    const file = relative(root, sourceFile.fileName)
    if (!file.startsWith('src/') || inPackage(sourceFile.fileName) || isTestFile(file)) continue
    for (const statement of sourceFile.statements) {
      const bindings = ts.isImportDeclaration(statement) && statement.importClause?.namedBindings
      if (!bindings || !ts.isNamedImports(bindings)) continue
      for (const element of bindings.elements) {
        if (element.isTypeOnly) continue
        let symbol = checker.getSymbolAtLocation(element.name)
        if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol)
        const name = byName.get(symbol)
        if (name && ownFile.get(name) !== file) users.get(name).add(file)
      }
    }
  }
  return new Map([...users].map(([name, set]) => [name, [...set].sort()]))
}

/** Splits user files into the modules, routes and platform areas they belong to. */
export function usersLabel(files) {
  const out = { modules: new Set(), routes: new Set(), platform: new Set(), other: new Set() }
  for (const file of files) {
    const parts = file.split('/')
    if (file.startsWith(`${ROUTES_ROOT}/`)) {
      out.routes.add(routeUrl(file.slice(ROUTES_ROOT.length + 1)))
    } else if (parts[1] === 'modules') out.modules.add(parts[2])
    else if (parts[1] === 'platform') out.platform.add(`platform/${parts[2]}`)
    else out.other.add(parts.slice(0, 3).join('/'))
  }
  return Object.fromEntries(Object.entries(out).map(([key, set]) => [key, [...set].sort()]))
}

const list = (items) => items.map(code).join(', ')

function renderUsers(files) {
  if (files.length === 0) return '**Used by** (direct imports): nothing yet.'
  const label = usersLabel(files)
  const lines = [
    ['Modules', label.modules],
    ['Routes', label.routes],
    ['Platform', label.platform],
    ['Elsewhere', label.other],
  ]
    .filter(([, items]) => items.length > 0)
    .map(([title, items]) => `${title}: ${list(items)}`)
  return ['**Used by** (direct imports):', '', ...lines.map((line) => `- ${line}`)].join('\n')
}

function renderProps(entry) {
  const plain = entry.props.filter((p) => !p.variant)
  const variants = entry.props.filter((p) => p.variant)
  const out = []
  if (variants.length > 0) {
    out.push('**Variants:**', '')
    // Outside a table a pipe needs no escape
    for (const v of variants) out.push(`- ${code(v.name)}: \`${v.type}\``)
    out.push('')
  }
  if (plain.length > 0) {
    out.push(
      table(
        ['Prop', 'Type', 'Required', 'Description'],
        plain.map((p) => [code(p.name), code(p.type), p.optional ? 'no' : 'yes', cell(p.doc)]),
      ),
      '',
    )
  } else if (variants.length === 0) {
    out.push('No props.', '')
  }
  if (entry.inherited > 0) {
    out.push(
      `${entry.inherited} more props from package types (HTML attributes and the like) are not listed.`,
      '',
    )
  }
  return out
}

/** One group's page: `group` is `{ title, intro }`; `components` are its described components. */
export function renderComponentPage(group, components, users) {
  const out = [
    `# Components: ${group.title}`,
    '',
    generatedNotice('the TypeScript types and imports under `src/`'),
    '',
    group.intro,
    '',
  ]
  for (const component of components) {
    out.push(`## ${code(component.name)}`, '')
    if (component.description) out.push(component.description, '')
    out.push(`Source: ${code(component.file)}`, '')
    out.push(...renderProps(component))
    for (const part of component.parts) {
      out.push(`### ${code(part.name)}`, '')
      if (part.description) out.push(part.description, '')
      out.push(...renderProps(part))
    }
    out.push(renderUsers(users.get(component.name) ?? []), '')
  }
  return out.join('\n')
}

/** Puts the components in their groups; fails on one in no group, or a name no component has. */
export function groupComponents(groups, components) {
  const byName = new Map(components.map((c) => [c.name, c]))
  const listed = new Set(groups.flatMap((g) => g.components))
  const missing = components.filter((c) => !listed.has(c.name)).map((c) => c.name)
  const stale = [...listed].filter((name) => !byName.has(name))
  if (missing.length > 0 || stale.length > 0) {
    throw new Error(
      [
        'scripts/reference/componentGroups.mjs is out of step with the components:',
        ...missing.map((name) => `  ${name} is exported but in no group`),
        ...stale.map((name) => `  ${name} is in a group but no longer exported`),
      ].join('\n'),
    )
  }
  return groups.map((g) => ({ ...g, components: g.components.map((name) => byName.get(name)) }))
}

/** The README of docs/reference/components/: one line per page. */
export function renderComponentIndex(groups) {
  const count = groups.reduce((total, g) => total + g.components.length, 0)
  return [
    '# Shared components',
    '',
    generatedNotice('the TypeScript types and imports under `src/`'),
    '',
    `${count} components from \`src/platform/ui/\` and \`src/platform/richtext/\`, with their props and where they are used. The rules every component follows, and the choices behind them, are in [component-set.md](../../ui/component-set.md). \`/dev/gallery\` shows them.`,
    '',
    table(
      ['Page', 'Components'],
      groups.map((g) => [
        `[${g.title}](${g.slug}.md)`,
        g.components.map((c) => code(c.name)).join(', '),
      ]),
    ),
    '',
  ].join('\n')
}
