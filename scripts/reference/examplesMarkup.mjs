/**
 * What an examples file may draw (#1532), by allow-list: a static export draws every example, so
 * the markup is a short list of plain elements and imported components, addresses are relative or
 * reserved example ones, and nothing reaches the page from an element. Anything else is refused.
 * This guards against mistakes and dangerous-by-accident code in a reviewed repository file; it is
 * not a sandbox (kit components and packages are trusted, review stays the control).
 */
import ts from 'typescript'

// Plain presentational HTML and svg shapes; no style, media, frame, form or link elements
const ELEMENTS_ALLOWED = new Set([
  ...['div', 'span', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'small', 'code', 'pre', 'br', 'hr'],
  ...['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'section'],
  ...['svg', 'g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon'],
])
// Ways to build an element from a value, which the element list cannot see
const ELEMENT_MAKERS = new Set(['createElement', 'cloneElement', 'jsx', 'jsxs', 'jsxDEV'])
// Member names that reach the page, or the prototype chain, from an element or a value
const HIDDEN = new Set([
  ...['constructor', '__proto__', 'innerHTML', 'outerHTML', 'insertAdjacentHTML'],
  ...['insertAdjacentElement', 'insertAdjacentText', 'ownerDocument', 'defaultView'],
  ...['srcdoc', 'srcDoc', 'contentWindow', 'contentDocument'],
])
const INJECTION = 'dangerouslySetInnerHTML'
const ADDRESS_ATTRIBUTES = new Set([
  ...['src', 'srcSet', 'srcset', 'href', 'xlinkHref', 'action', 'formAction'],
  ...['poster', 'data', 'cite', 'ping', 'manifest'],
])
// A reserved example address (RFC 2606): the one absolute address a link may show
const EXAMPLE_ADDRESS = /^https:\/\/(www\.)?example\.(com|org|net)(\/|$)/i
const SCHEME = /^([a-z][a-z0-9+.-]*:|[/\\]{2}|\\)/i
const FETCHES = /(^|[^\w-])(url|image-set|src)\s*\(|@import/i
const SCRIPT_URL = /^\s*javascript:/i

const componentCache = new WeakMap()

/** The names a file's own components can have: imported, or a function or arrow at the top level. */
function componentNames(sourceFile) {
  if (componentCache.has(sourceFile)) return componentCache.get(sourceFile)
  const names = new Set()
  for (const statement of sourceFile.statements) {
    const clause = ts.isImportDeclaration(statement) && statement.importClause
    if (clause) {
      if (clause.name) names.add(clause.name.text)
      const bound = clause.namedBindings
      if (bound && ts.isNamespaceImport(bound)) names.add(bound.name.text)
      if (bound && ts.isNamedImports(bound)) bound.elements.forEach((e) => names.add(e.name.text))
    }
    if (ts.isFunctionDeclaration(statement) && statement.name) names.add(statement.name.text)
    if (!ts.isVariableStatement(statement)) continue
    for (const d of statement.declarationList.declarations) {
      const init = d.initializer
      if (
        ts.isIdentifier(d.name) &&
        init &&
        (ts.isArrowFunction(init) || ts.isFunctionExpression(init))
      ) {
        names.add(d.name.text)
      }
    }
  }
  componentCache.set(sourceFile, names)
  return names
}

const rootOf = (tag) => (ts.isPropertyAccessExpression(tag) ? rootOf(tag.expression) : tag)

/** Whether a JSX tag is an allowed element or one of the file's components. */
function tagAllowed(tag, components) {
  const root = rootOf(tag)
  if (!ts.isIdentifier(root)) return false
  if (ts.isIdentifier(tag) && /^[a-z]/.test(tag.text)) return ELEMENTS_ALLOWED.has(tag.text)
  return components.has(root.text)
}

/** Whether a literal address is relative, a plain fragment or a reserved example address. */
const addressAllowed = (value, name) => {
  const plain = value.replace(/[\u0000- ]/g, '')
  return !SCHEME.test(plain) || (name === 'href' && EXAMPLE_ADDRESS.test(plain))
}

function checkAttribute(node, fail, owner, at) {
  const name = node.name.getText()
  if (!ADDRESS_ATTRIBUTES.has(name)) return
  const value = node.initializer
  const literal =
    value &&
    (ts.isStringLiteral(value)
      ? value.text
      : ts.isJsxExpression(value) && value.expression && ts.isStringLiteralLike(value.expression)
        ? value.expression.text
        : null)
  if (literal === null || literal === undefined || !addressAllowed(literal, name)) {
    fail(
      `${owner}passes ${name} that is not a relative address, a fragment or an example address ${at}`,
    )
  }
}

/** Every markup refusal for one node; `components` are the names the file may use as elements. */
export function checkMarkup(node, sourceFile, fail, owner, at) {
  const components = componentNames(sourceFile)
  const tag = ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node) ? node.tagName : null
  if (tag && !tagAllowed(tag, components)) {
    fail(`${owner}uses <${tag.getText()}>, which is not an element an example may draw ${at}`)
  }
  if (ts.isJsxAttribute(node)) checkAttribute(node, fail, owner, at)
  if (!ts.isIdentifier(node) && !ts.isStringLiteralLike(node) && !ts.isTemplateExpression(node))
    return
  const text = ts.isTemplateExpression(node) ? node.head.text : node.text
  if (ts.isIdentifier(node) && (ELEMENT_MAKERS.has(text) || text === INJECTION)) {
    fail(`${owner}reaches ${text} ${at}`)
  }
  if (!ts.isIdentifier(node) && SCRIPT_URL.test(text))
    fail(`${owner}has a javascript: address ${at}`)
  if (!ts.isIdentifier(node) && FETCHES.test(text))
    fail(`${owner}has a url( or @import that loads something ${at}`)
  const hidden =
    ts.isIdentifier(node) ||
    ts.isElementAccessExpression(node.parent) ||
    ts.isComputedPropertyName(node.parent)
  if (hidden && HIDDEN.has(text)) fail(`${owner}reaches ${text} ${at}`)
}
