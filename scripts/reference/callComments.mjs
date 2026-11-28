/**
 * The doc comment of the function a Local API call sits in (#1461): the reason the pages quote
 * where a call skips access.
 */
import ts from 'typescript'

/**
 * The nearest function a node sits in, as the node that carries its doc comment: the declaration,
 * or the `const` statement that holds an arrow or function expression. A `const` that only holds
 * a call's result is not a function and is passed over.
 */
function functionAround(node) {
  for (let n = node.parent; n; n = n.parent) {
    if (ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n)) return n
    const holdsFunction =
      (ts.isArrowFunction(n) || ts.isFunctionExpression(n)) && ts.isVariableDeclaration(n.parent)
    if (holdsFunction) return n.parent.parent.parent
  }
  return undefined
}

/** The doc comment above the function a node sits in: its first two sentences, then `…` if cut. */
export function commentAround(node) {
  const holder = functionAround(node)
  if (!holder) return ''
  const sourceFile = holder.getSourceFile()
  const ranges = ts.getLeadingCommentRanges(sourceFile.text, holder.pos) ?? []
  const last = ranges.filter((r) => sourceFile.text.startsWith('/**', r.pos)).pop()
  if (!last) return ''
  const text = sourceFile.text
    .slice(last.pos + 3, last.end - 2)
    .replace(/^\s*\*\s?/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const sentences = text.split(/(?<=\.)\s/)
  // A comment cut after two sentences says so, so a reader knows there is more
  return sentences.length > 2 ? `${sentences.slice(0, 2).join(' ')} …` : text
}
