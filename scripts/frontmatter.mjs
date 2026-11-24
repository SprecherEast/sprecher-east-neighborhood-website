/** Reading the YAML frontmatter at the top of a Markdown file, in one place. */
import yaml from 'js-yaml'

/**
 * Accepts what `agent-context` accepted for the closing line (trailing spaces, more dashes after
 * the three). For `check-intelligence` it also adds Windows line endings and a file that ends right
 * after the closing line (`agent-context` already took both). The opening line stays strict, as in
 * both callers before: `---` and a newline, nothing else.
 */
const FRONTMATTER = /^---\n([\s\S]*?)\n---/

/** The raw text between the opening and closing `---`, or `null` when the file has none. */
export function frontmatterText(markdown) {
  const match = FRONTMATTER.exec(markdown.replace(/\r\n/g, '\n'))
  return match ? match[1] : null
}

/** The frontmatter as an object (`{}` when there is none). `options` go to `js-yaml`'s `load`. */
export function parseFrontmatter(markdown, options) {
  const text = frontmatterText(markdown)
  return text === null ? {} : (yaml.load(text, options) ?? {})
}
