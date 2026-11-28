import { describe, expect, it } from 'vitest'

import { exampleAnchor, examplesFilesFor, exampleTitle } from './examplesReader.mjs'
import {
  CLIENT_FILE,
  FILE,
  IMPORTS,
  ONE,
  read,
  readExamples,
  withBody,
} from './examplesFixture.mjs'

const EXAMPLES = `${IMPORTS}
export const Plain = defineExample({
  purpose: 'The ordinary thing',
  render: () => <Thing>Hello</Thing>,
})

export const WithSettings = defineExample({
  purpose: 'A thing whose words and look can change',
  of: ['Thing', 'ThingPart'],
  settings: {
    tone: { kind: 'choice', options: ['calm', 'loud'], default: 'calm', description: 'How it sounds' },
    shout: { kind: 'boolean', default: false },
    words: { kind: 'text', default: 'Hello' },
  },
  render: ({ tone, shout, words }) => (
    <Thing tone={tone} shout={shout}>
      {words}
    </Thing>
  ),
})
`

describe('exampleTitle and exampleAnchor', () => {
  it('turn an export name into words and a link name', () => {
    expect(exampleTitle('SecondTabOpen')).toBe('Second tab open')
    expect(exampleAnchor('SecondTabOpen')).toBe('second-tab-open')
    expect(exampleAnchor('AsLink')).toBe('as-link')
    expect(exampleAnchor('Plain')).toBe('plain')
  })
})

describe('examplesFilesFor', () => {
  it('names a server and a client examples file beside the component file', () => {
    expect(examplesFilesFor('src/platform/ui/Button.tsx')).toEqual([
      { file: 'src/platform/ui/Button.examples.tsx', kind: 'server' },
      { file: 'src/platform/ui/Button.examples.client.tsx', kind: 'client' },
    ])
    expect(examplesFilesFor('src/platform/ui/Tabs.client.tsx').map((f) => f.file)).toEqual([
      'src/platform/ui/Tabs.examples.tsx',
      'src/platform/ui/Tabs.examples.client.tsx',
    ])
    expect(examplesFilesFor('src/platform/ui/chart/Chart.tsx')[0].file).toBe(
      'src/platform/ui/chart/Chart.examples.tsx',
    )
  })
})

describe('readExamples: what it yields', () => {
  it('gives each configuration its name, purpose, settings, kind, file and its own source', () => {
    const [plain, withSettings] = readExamples(EXAMPLES, FILE)

    expect(plain).toMatchObject({
      name: 'Plain',
      title: 'Plain',
      anchor: 'plain',
      purpose: 'The ordinary thing',
      of: null,
      kind: 'server',
      file: FILE,
      settings: {},
      source: '() => <Thing>Hello</Thing>',
    })
    expect(withSettings).toMatchObject({ title: 'With settings', anchor: 'with-settings' })
    expect(withSettings.of).toEqual(['Thing', 'ThingPart'])
    expect(withSettings.settings).toEqual({
      tone: {
        kind: 'choice',
        options: ['calm', 'loud'],
        default: 'calm',
        description: 'How it sounds',
      },
      shout: { kind: 'boolean', default: false },
      words: { kind: 'text', default: 'Hello' },
    })
  })

  it('reads the source from the file, without the indentation it has there', () => {
    const [, withSettings] = readExamples(EXAMPLES, FILE)

    expect(withSettings.source).toBe(
      [
        '({ tone, shout, words }) => (',
        '  <Thing tone={tone} shout={shout}>',
        '    {words}',
        '  </Thing>',
        ')',
      ].join('\n'),
    )
  })

  it('keeps blank lines inside the source and takes the indentation from the other lines', () => {
    const text = `${IMPORTS}export const A = defineExample({
  purpose: 'x',
  render: () => {
    const a = 1

    return <Thing>{a}</Thing>
  },
})
`
    expect(readExamples(text, FILE)[0].source).toBe(
      '() => {\n  const a = 1\n\n  return <Thing>{a}</Thing>\n}',
    )
  })

  it('says where each one starts, so the page can link to the file', () => {
    const [plain, withSettings] = readExamples(EXAMPLES, FILE)

    expect([plain.line, withSettings.line]).toEqual([4, 9])
  })

  it('reads a render written as a function expression or a method', () => {
    const fn = readExamples(
      `${IMPORTS}export const A = defineExample({ purpose: 'x', render: function () { return null } })\n`,
      FILE,
    )
    const method = readExamples(
      `${IMPORTS}export const A = defineExample({ purpose: 'x', render() { return null } })\n`,
      FILE,
    )

    expect(fn[0].source).toBe('function () { return null }')
    expect(method[0].source).toBe('render() { return null }')
  })

  it('reads `true` and numbers in settings, and `true` as a default', () => {
    const [a] = read(
      withBody("settings: { on: { kind: 'boolean', default: true } }, render: () => null"),
    )

    expect(a.settings.on.default).toBe(true)
  })
})

describe('readExamples: the source is copyable', () => {
  const text = `${IMPORTS}
type Look = 'a' | 'b'
const WORDS: Record<Look, string> = { a: 'One', b: 'Two' }
const unused = 3
const heading = (look: Look) => WORDS[look]
export const A = defineExample({
  purpose: 'x',
  render: () => <Thing>{heading('a')}</Thing>,
})
`

  it('puts the helpers the render uses, with the types and constants they use, before it', () => {
    expect(readExamples(text, FILE)[0].source).toBe(
      [
        "type Look = 'a' | 'b'",
        '',
        "const WORDS: Record<Look, string> = { a: 'One', b: 'Two' }",
        '',
        'const heading = (look: Look) => WORDS[look]',
        '',
        "() => <Thing>{heading('a')}</Thing>",
      ].join('\n'),
    )
  })

  it('leaves out what the render does not use, and an import', () => {
    expect(readExamples(text, FILE)[0].source).not.toContain('unused')
    expect(readExamples(text, FILE)[0].source).not.toContain('import')
  })
})

describe('readExamples: server and client files', () => {
  const CLIENT = `'use client'\n\n${IMPORTS}`
  const press = `export const A = defineExample({ purpose: 'x', render: () => <Thing onPress={() => {}} /> })\n`

  it('reads a client file as client examples, and needs its directive', () => {
    expect(readExamples(`${CLIENT}${press}`, CLIENT_FILE)[0].kind).toBe('client')
    expect(() => readExamples(`${IMPORTS}${press}`, CLIENT_FILE)).toThrow(/needs 'use client'/)
  })

  it('refuses the directive in a server file', () => {
    expect(() =>
      readExamples(
        `${CLIENT}${ONE.replace('defineExample', 'export const A = defineExample')}\n`,
        FILE,
      ),
    ).toThrow(/server examples file may not start with 'use client'/)
  })

  it('refuses an event handler or a hook in a server file, and says to move it', () => {
    expect(() => read(press)).toThrow(
      /A passes onPress; an example with a handler goes in Thing\.examples\.client\.tsx/,
    )
    expect(() =>
      read(
        `export const A = defineExample({ purpose: 'x', render: () => <Thing onClick={null} /> })\n`,
      ),
    ).toThrow(/passes onClick/)
    expect(() =>
      read(`export const A = defineExample({ purpose: 'x', render: () => String(useState(1)) })\n`),
    ).toThrow(
      /uses useState; an example with state or effects goes in Thing\.examples\.client\.tsx/,
    )
  })

  it('allows them in a client file', () => {
    const hook = `export const A = defineExample({ purpose: 'x', render: () => <Thing a={useState(1)} /> })\n`
    expect(() => readExamples(`${CLIENT}${hook}`, CLIENT_FILE)).not.toThrow()
  })
})
