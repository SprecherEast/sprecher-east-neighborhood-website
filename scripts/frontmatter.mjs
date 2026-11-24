/** Reading the YAML frontmatter at the top of a Markdown file, in one place. */
import yaml from 'js-yaml'

const FRONTMATTER = /^---\n([\s\S]*?)\n---(?:\n|$)/

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
