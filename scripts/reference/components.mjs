/**
 * The shared-components reference (#718, decision 0019 §4). Uses the TypeScript compiler API (the
 * type checker the project already runs): for each exported component it reads the props type the
 * compiler resolves, so a changed prop changes the page. Where a component is used comes from the
 * import declarations of the whole program, followed through barrel files to the original symbol.
 */
import path from 'node:path'
import ts from 'typescript'

const TYPE_LIMIT = 160
const TYPE_FLAGS =
  ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope
const inPackage = (file) => file.includes('/node_modules/')
// A story or an example is not a real use of a component either (#1447, #1532): it only shows it
const isTestFile = (file) =>
  /\.(test|spec|stories|examples(\.client)?)\.tsx?$/.test(file) || file.includes('/testing/')
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

/** The values a variant takes, when its type is a list of literals (text, numbers, true, false); else `null`. */
function literalOptions(checker, type) {
  const plain = checker.getNonNullableType(type)
  const values = (plain.isUnion() ? plain.types : [plain]).map((member) => {
    if (member.isStringLiteral() || member.isNumberLiteral()) return member.value
    return member.flags & ts.TypeFlags.BooleanLiteral ? member.intrinsicName === 'true' : undefined
  })
  return values.every((value) => value !== undefined) ? values : null
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
    const propType = checker.getTypeOfSymbolAtLocation(symbol, location)
    const variant = fromVariantHelper || variantNames.has(symbol.getName())
    props.push({
      name: symbol.getName(),
      type: shownType(checker, propType, optional, location),
      optional,
      doc: docOf(checker, symbol),
      variant,
      // What a variant can be, for the showcase's controls (#1532); the pages don't print it
      options: variant ? literalOptions(checker, propType) : null,
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
