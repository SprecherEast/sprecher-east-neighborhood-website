/** Shared fixtures for the knowledge-structure tests: the real schema and a note that passes. */
import fs from 'node:fs'

export const schema = JSON.parse(fs.readFileSync('docs/knowledge/note-schema.json', 'utf8'))

export const NOTE_PATH = 'src/modules/demo/README.md'

/** A schema whose structure rules all block (the coverage rules keep their own state). */
export const strict = {
  ...schema,
  rules: Object.fromEntries(
    Object.entries(schema.rules).map(([id, rule]) => [
      id,
      id.startsWith('COVERAGE') ? rule : { ...rule, severity: 'block' },
    ]),
  ),
}

/** Only the findings that would fail the check. */
export const errorsOf = (found) => found.filter((f) => f.severity === 'error')

/** A front matter block from fields; `undefined` values are left out. */
export function frontmatter(fields) {
  const lines = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
  return `---\n${lines.join('\n')}\n---\n`
}

export const GOOD_FIELDS = {
  name: 'Demo',
  type: 'module',
  summary: 'What the demo is for',
  aliases: [],
  relationships: [],
}

export const GOOD_BODY = `# Demo

The demo module, for a test. See \`domain/rule.ts\`.

## Behaviors and events

- A thing happens (\`domain/rule.ts\`).
`

/** A note that passes every rule against GOOD_FILES. */
export const goodNote = (fields = GOOD_FIELDS, body = GOOD_BODY) =>
  frontmatter(fields) + '\n' + body

export const GOOD_FILES = [NOTE_PATH, 'src/modules/demo/domain/rule.ts', 'docs/knowledge/index.md']

export const GOOD_MAP = JSON.stringify([{ note: NOTE_PATH, paths: ['src/modules/demo/**'] }])

export const goodIndex = (
  line = '- [Demo](../../src/modules/demo/README.md): What the demo is for',
) => `# Knowledge index\n\n## Notes\n\n${line}\n\n## Reference (generated)\n\n- [x](y.md): z\n`
