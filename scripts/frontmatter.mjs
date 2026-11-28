/** Reading the YAML frontmatter at the top of a Markdown file, in one place. */
import yaml from 'js-yaml'

/**
 * Accepts what `agent-context` accepted for the closing line (trailing spaces, more dashes after
 * the three). For `check-intelligence` it also adds Windows line endings and a file that ends right
 * after the closing line (`agent-context` already took both). The opening line stays strict, as in
 * both callers before: `---` and a newline, nothing else.
 */
const FRONTMATTER = /^---\n([\s\S]*?)\n---/

/**
 * The file in two parts, both from the one match: `text` is what lies between the opening and
 * closing `---` (`null` when the file has none), and `rest` is everything after the closing `---`,
 * starting with the rest of that line. Without front matter, `rest` is the whole file.
 */
export function splitFrontmatter(markdown) {
  const text = markdown.replace(/\r\n/g, '\n')
  const match = FRONTMATTER.exec(text)
  return match ? { text: match[1], rest: text.slice(match[0].length) } : { text: null, rest: text }
}

/** The raw text between the opening and closing `---`, or `null` when the file has none. */
export const frontmatterText = (markdown) => splitFrontmatter(markdown).text

/** The frontmatter as an object (`{}` when there is none). `options` go to `js-yaml`'s `load`. */
export function parseFrontmatter(markdown, options) {
  const text = frontmatterText(markdown)
  return text === null ? {} : (yaml.load(text, options) ?? {})
}
