/** Shared fixtures for the knowledge-structure tests: the real schema and a note that passes. */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { checkKnowledge } from './check.mjs'

/** The schema as the repository has it: every rule blocks (#1004). */
export const realSchema = JSON.parse(fs.readFileSync('docs/knowledge/note-schema.json', 'utf8'))

const COVERAGE_RULES = ['COVERAGE-SECTION', 'COVERAGE-CODE', 'NOTE-PATH']

/**
 * The schema the fixtures run against: the real one, with the content rules back to warnings. A
 * fixture is a small note on purpose, so it lacks sections and code the real repository has; the
 * tests that need a rule to block say so by using `realSchema` or `strict`.
 */
export const schema = {
  ...realSchema,
  rules: Object.fromEntries(
    Object.entries(realSchema.rules).map(([id, rule]) => [
      id,
      COVERAGE_RULES.includes(id) ? 'warn' : rule,
    ]),
  ),
}

export const NOTE_PATH = 'src/modules/demo/README.md'

/** A schema whose structure rules all block (the fixtures' content rules stay warnings). */
export const strict = {
  ...schema,
  rules: Object.fromEntries(
    Object.entries(schema.rules).map(([id, rule]) => [
      id,
      id.startsWith('COVERAGE') ? rule : 'block',
    ]),
  ),
}

/** The message a function throws, or undefined: lets a test compare it whole. */
export function messageOf(fn) {
  try {
    fn()
  } catch (error) {
    return error.message
  }
  return undefined
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

/** The findings of one rule, as their messages. */
export const messagesOf = (found, rule) =>
  found.filter((f) => f.rule === rule).map((f) => f.message)

/**
 * The whole check over an in-memory repository: the note and index of the good example, replaced
 * or extended by `texts`, with `files`, `map` and `schema` as given.
 */
export const repo = (over = {}) => {
  const texts = {
    [NOTE_PATH]: goodNote(),
    'docs/knowledge/index.md': goodIndex(),
    ...over.texts,
  }
  const files = over.files ?? [...new Set([...GOOD_FILES, ...Object.keys(texts)])]
  return checkKnowledge({
    schema: over.schema ?? strict,
    mapJson: over.map ?? GOOD_MAP,
    files,
    read: (file) => texts[file],
  })
}

/** Throwaway git repositories made by `fixture`; a test file removes them after each test. */
export const fixtureRoots = []
export const removeFixtures = () =>
  fixtureRoots.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }))

/** A throwaway repository with the schema, a map, an index, one note and its code file. */
export function fixture({ note = goodNote(), index = goodIndex(), schemaJson = schema } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-'))
  fixtureRoots.push(root)
  const files = {
    'docs/knowledge/note-schema.json': JSON.stringify(schemaJson),
    'docs/knowledge/map.json': GOOD_MAP,
    'docs/knowledge/index.md': index,
    [NOTE_PATH]: note,
    'src/modules/demo/domain/rule.ts': 'export {}\n',
  }
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    fs.writeFileSync(path.join(root, file), text)
  }
  execFileSync('git', ['init', '-q'], { cwd: root })
  return root
}
