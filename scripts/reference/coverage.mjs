/**
 * The UI element coverage reference (#495, decision 0019 §4): which component and variant each
 * element of the UI inventory maps to. The element tables in `docs/ui/elements-*.md` are the
 * source; their last column, "Target component · variant", is the mapping, so nothing here is
 * written twice. Pure functions; the generator reads the files.
 */
import { cell, generatedNotice, table } from '../content-types/render.mjs'

/** The element tables, read by the generator. */
export const ELEMENT_FILES = [
  'docs/ui/elements-content.md',
  'docs/ui/elements-forms-feedback.md',
  'docs/ui/elements-layout-navigation.md',
]

const ID = /^([A-Z]+)([0-9]+)$/

/** Splits a table row into cells; a pipe inside backticks or escaped with a backslash stays. */
function splitRow(line) {
  const cells = []
  let current = ''
  let inCode = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '\\' && line[i + 1] === '|') {
      current += '|'
      i++
    } else if (char === '`') {
      inCode = !inCode
      current += char
    } else if (char === '|' && !inCode) {
      cells.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  cells.push(current.trim())
  return cells.slice(1, -1)
}

/** Every element row of a page: an ID, the element's name and its last column. */
export function parseElementRows(markdown) {
  const rows = []
  for (const line of markdown.split('\n')) {
    if (!line.startsWith('|')) continue
    const cells = splitRow(line)
    if (cells.length < 3 || !ID.test(cells[0])) continue
    rows.push({ id: cells[0], element: cells[1], target: cells[cells.length - 1] })
  }
  return rows
}

/** `Button · primary` to its two parts, or nothing when it is not exactly one of each. */
function splitTarget(target) {
  const parts = target.split(' · ')
  const valid = parts.length === 2 && parts.every((part) => part.length > 0 && !/[;/,]/.test(part))
  return valid ? { component: parts[0], variant: parts[1] } : undefined
}

const byId = (a, b) => {
  const [, letters, digits] = ID.exec(a)
  const [, otherLetters, otherDigits] = ID.exec(b)
  return letters === otherLetters ? digits - otherDigits : letters < otherLetters ? -1 : 1
}

/**
 * Groups the elements by component and variant. Throws, naming the element, when an ID is
 * malformed or used twice, or when an element does not map to exactly one component and variant.
 */
export function buildCoverage(rows) {
  const seen = new Set()
  const groups = new Map()
  for (const { id, element, target } of rows) {
    if (!ID.test(id)) throw new Error(`"${id}" is not an element ID (letters, then a number)`)
    if (seen.has(id)) throw new Error(`Element ${id} appears twice: give one of them its own ID`)
    seen.add(id)
    const parts = splitTarget(target)
    if (!parts) {
      throw new Error(
        `Element ${id} (${element}) must map to exactly one "Component · variant", not "${target}"`,
      )
    }
    const key = `${parts.component} · ${parts.variant}`
    if (!groups.has(key)) groups.set(key, { ...parts, ids: [] })
    groups.get(key).ids.push(id)
  }
  const list = [...groups.values()]
    .map((group) => ({ ...group, ids: group.ids.sort(byId) }))
    .sort((a, b) => a.component.localeCompare(b.component) || a.variant.localeCompare(b.variant))
  return {
    groups: list,
    elements: seen.size,
    pairs: list.length,
    components: new Set(list.map((group) => group.component)).size,
  }
}

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`

export function renderCoverage({ groups, elements, pairs, components }) {
  const rows = groups.map(({ component, variant, ids }) => [
    cell(`${component} · ${variant}`),
    ids.join(', '),
    String(ids.length),
  ])
  return [
    '# UI element coverage',
    '',
    generatedNotice(
      'the element tables in `docs/ui/elements-*.md` (their "Target component · variant" column)',
      'change the element table',
    ),
    '',
    `Every element of the [UI inventory](../ui/inventory.md) maps to exactly one component and variant: ${plural(elements, 'element')}, ${plural(pairs, 'component-variant pair')}, ${plural(components, 'component')}. The generator fails when an ID appears twice or an element names more than one component or variant. A name in braces, like \`{appearance}\`, means a CMS field or the state picks the variant. The components are described in [component-set.md](../ui/component-set.md).`,
    '',
    table(['Component · variant', 'Elements', 'Count'], rows),
    '',
  ].join('\n')
}
