import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import ts from 'typescript'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { renderComponentPage } from './componentPages.mjs'
import { describeComponents, findUsers } from './components.mjs'

let root
const write = (file, text) => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
  fs.writeFileSync(path.join(root, file), text)
}

function load(entryFiles) {
  const program = ts.createProgram({
    rootNames: entryFiles.map((file) => path.join(root, file)),
    options: {
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      baseUrl: root,
      paths: { '@/*': ['src/*'] },
    },
  })
  return program
}

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'reference-components-'))
  // A stand-in for the variant helper: props declared in this package count as variants
  write(
    'node_modules/class-variance-authority/index.d.ts',
    "export interface Variants { tone?: 'info' | 'error' | null; level?: 1 | 2 | null; flag?: boolean | null; mix?: 'a' | boolean | null; loose?: 'x' | string | null }\n",
  )
  write(
    'node_modules/other/index.d.ts',
    'export interface Native { title?: string; id?: string }\n',
  )
  write(
    'src/platform/ui/Alert.ts',
    `import type { Variants } from 'class-variance-authority'
import type { Native } from 'other'

type Props = Variants & Native & {
  /** The heading above the message */
  heading: string
  count?: number
  size?: 'sm' | 'md'
}

declare function cva(base: string, config: { variants: Record<string, Record<string, string>> }): void
cva('x', { variants: { size: { sm: 'a', md: 'b' } } })

/** A box that tells the reader something. */
export function Alert(props: Props) { return props.heading }
export const ALERT_LIMIT = 3
export function useAlert() { return 1 }
export type AlertProps = Props
`,
  )
  write(
    'src/platform/ui/Field.ts',
    `function Frame(props: { label: string }) { return props.label }
function Input(props: { size?: 'md' | 'lg' }) { return props.size }
export const Field = Object.assign(Frame, { Input })
`,
  )
  write(
    'src/platform/ui/index.ts',
    "export { Alert, type AlertProps } from './Alert'\nexport { Field } from './Field'\n",
  )
  write(
    'src/modules/events/ui/List.ts',
    "import { Alert } from '@/platform/ui'\nexport const List = () => Alert({ heading: 'x' })\n",
  )
  write(
    'src/app/(frontend)/events/page.ts',
    "import { Alert } from '@/platform/ui/Alert'\nexport default () => Alert({ heading: 'x' })\n",
  )
  write(
    'src/app/(frontend)/events/page.test.ts',
    "import { Alert } from '@/platform/ui/Alert'\nexport const t = Alert\n",
  )
  write(
    'src/platform/ui/Alert.stories.ts',
    "import { Alert } from './Alert'\nexport const Playground = Alert\n",
  )
  write(
    'src/platform/ui/Alert.examples.ts',
    "import { Alert } from './Alert'\nexport const Default = Alert\n",
  )
})

afterAll(() => fs.rmSync(root, { recursive: true, force: true }))

const files = ['src/platform/ui/Alert.ts', 'src/platform/ui/Field.ts']
const sources = [
  ...files,
  'src/platform/ui/index.ts',
  'src/modules/events/ui/List.ts',
  'src/app/(frontend)/events/page.ts',
  'src/app/(frontend)/events/page.test.ts',
  'src/platform/ui/Alert.stories.ts',
  'src/platform/ui/Alert.examples.ts',
]

describe('describeComponents', () => {
  it('finds exported components, not constants, hooks or types', () => {
    const program = load(sources)
    const found = describeComponents(program, root, files)
    expect(found.map((c) => c.name)).toEqual(['Alert', 'Field'])
  })

  it('lists props with type, optionality and the comment, and marks variants', () => {
    const [alert] = describeComponents(load(sources), root, files)
    expect(alert.description).toBe('A box that tells the reader something.')
    expect(alert.file).toBe('src/platform/ui/Alert.ts')
    const byName = Object.fromEntries(alert.props.map((p) => [p.name, p]))
    expect(byName.heading).toMatchObject({
      type: 'string',
      optional: false,
      doc: 'The heading above the message',
      variant: false,
    })
    expect(byName.count).toMatchObject({ type: 'number', optional: true })
    expect(byName.tone).toMatchObject({ type: '"info" | "error"', variant: true })
    expect(byName.size).toMatchObject({ type: '"sm" | "md"', variant: true })
  })

  it('lists the values of a variant that is a list of literals, and none for other props (#1532)', () => {
    const [alert] = describeComponents(load(sources), root, files)
    const byName = Object.fromEntries(alert.props.map((p) => [p.name, p]))
    expect(byName.tone.options).toEqual(['info', 'error'])
    expect(byName.size.options).toEqual(['sm', 'md'])
    expect(byName.heading.options).toBeNull()
    expect(byName.count.options).toBeNull()
    // Numbers and booleans are values too; a list that is also open text has no fixed values
    expect(byName.level.options).toEqual([1, 2])
    expect(byName.flag.options).toEqual([false, true])
    expect(byName.mix.options).toEqual(expect.arrayContaining(['a', true, false]))
    expect(byName.mix.options).toHaveLength(3)
    expect(byName.loose.options).toBeNull()
  })

  it('counts props inherited from a package instead of listing them', () => {
    const [alert] = describeComponents(load(sources), root, files)
    expect(alert.props.map((p) => p.name).sort()).toEqual([
      'count',
      'flag',
      'heading',
      'level',
      'loose',
      'mix',
      'size',
      'tone',
    ])
    expect(alert.inherited).toBe(2)
  })

  it('lists the parts attached to a component', () => {
    const field = describeComponents(load(sources), root, files)[1]
    expect(field.props.map((p) => p.name)).toEqual(['label'])
    expect(field.parts.map((p) => p.name)).toEqual(['Field.Input'])
    expect(field.parts[0].props.map((p) => p.name)).toEqual(['size'])
  })
})

describe('findUsers', () => {
  it('finds importers through a barrel file and directly, skipping tests, stories and examples', () => {
    const program = load(sources)
    const found = describeComponents(program, root, files)
    const users = findUsers(program, root, found)
    expect(users.get('Alert')).toEqual([
      'src/app/(frontend)/events/page.ts',
      'src/modules/events/ui/List.ts',
    ])
    expect(users.get('Field')).toEqual([])
  })
})

describe('renderComponentPage', () => {
  it('writes props, variants, parts and users for each component', () => {
    const program = load(sources)
    const found = describeComponents(program, root, files)
    const users = findUsers(program, root, found)
    const text = renderComponentPage(
      { title: 'Feedback', intro: 'Tells the reader.' },
      found,
      users,
    )
    expect(text).toContain('# Components: Feedback')
    expect(text).toContain('Generated by `npm run docs:generate`')
    expect(text).toContain('## `Alert`')
    expect(text).toContain('| `heading` | `string` | yes | The heading above the message |')
    expect(text).toContain('**Variants:**')
    expect(text).toContain('`tone`: `"info" | "error"`')
    expect(text).toContain('2 more props from package types')
    expect(text).toContain('### `Field.Input`')
    expect(text).toContain('**Used by**')
    expect(text).toContain('Modules: `events`')
    expect(text).toContain('Routes: `/events`')
  })
})
