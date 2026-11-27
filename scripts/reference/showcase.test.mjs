import { describe, expect, it } from 'vitest'

import {
  buildShowcaseIndex,
  exampleAnchor,
  examplesFileFor,
  exampleTitle,
  readExamples,
  renderShowcaseIndex,
} from './showcase.mjs'

const FILE = 'src/platform/ui/Thing.examples.tsx'

const EXAMPLES = `import { Thing } from './Thing'
import { defineExample } from './example'

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

describe('examplesFileFor', () => {
  it('puts the examples beside the component file, whether or not it is a client file', () => {
    expect(examplesFileFor('src/platform/ui/Button.tsx')).toBe(
      'src/platform/ui/Button.examples.tsx',
    )
    expect(examplesFileFor('src/platform/ui/Tabs.client.tsx')).toBe(
      'src/platform/ui/Tabs.examples.tsx',
    )
    expect(examplesFileFor('src/platform/ui/chart/Chart.tsx')).toBe(
      'src/platform/ui/chart/Chart.examples.tsx',
    )
  })
})

describe('readExamples', () => {
  it('yields each configuration with its name, purpose, settings and its own source', () => {
    const [plain, withSettings] = readExamples(EXAMPLES, FILE)

    expect(plain).toMatchObject({
      name: 'Plain',
      title: 'Plain',
      anchor: 'plain',
      purpose: 'The ordinary thing',
      of: null,
      settings: {},
      source: '() => <Thing>Hello</Thing>',
    })
    expect(withSettings.name).toBe('WithSettings')
    expect(withSettings.title).toBe('With settings')
    expect(withSettings.anchor).toBe('with-settings')
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

  it('says where each one starts, so the page can link to the file', () => {
    const [plain, withSettings] = readExamples(EXAMPLES, FILE)

    expect([plain.line, withSettings.line]).toEqual([4, 9])
  })

  it('fails when an export is not an example', () => {
    expect(() => readExamples(`export const SIZE = 3\n`, FILE)).toThrow(
      /Thing\.examples\.tsx: SIZE is not a defineExample/,
    )
    expect(() => readExamples(`export default 3\n`, FILE)).toThrow(/default export/)
  })

  it('fails without a purpose, with a purpose over one line or too long', () => {
    const make = (purpose) => `export const A = defineExample({ ${purpose}, render: () => null })\n`
    expect(() => readExamples(make(''), FILE)).toThrow(/A has no purpose/)
    expect(() => readExamples(make("purpose: ''"), FILE)).toThrow(/A has no purpose/)
    expect(() => readExamples(make('purpose: `a\nb`'), FILE)).toThrow(/A: the purpose is one line/)
    expect(() => readExamples(make(`purpose: '${'x'.repeat(121)}'`), FILE)).toThrow(
      /A: the purpose is one line/,
    )
  })

  it('fails without a render function', () => {
    expect(() => readExamples(`export const A = defineExample({ purpose: 'x' })\n`, FILE)).toThrow(
      /A has no render function/,
    )
  })

  it('fails on a setting that is not plain data or not of a known kind', () => {
    const make = (settings) =>
      `export const A = defineExample({ purpose: 'x', settings: ${settings}, render: () => null })\n`
    expect(() => readExamples(make('{ a: SOMETHING }'), FILE)).toThrow(
      /A: settings must be plain data/,
    )
    expect(() => readExamples(make("{ a: { kind: 'slider', default: 1 } }"), FILE)).toThrow(
      /A: setting a has kind slider/,
    )
    expect(() =>
      readExamples(make("{ a: { kind: 'choice', options: ['x'], default: 'y' } }"), FILE),
    ).toThrow(/A: setting a has a default that is not one of its options/)
    expect(() => readExamples(make("{ a: { kind: 'boolean', default: 'no' } }"), FILE)).toThrow(
      /A: setting a needs a default of its kind/,
    )
  })

  it('fails on a duplicate name', () => {
    const one = `defineExample({ purpose: 'x', render: () => null })`
    expect(() => readExamples(`export const A = ${one}\nexport const a = ${one}\n`, FILE)).toThrow(
      /a has the same link name as A/,
    )
  })

  it('keeps examples to plain data and components: no CMS, server or network access', () => {
    const body = `export const A = defineExample({ purpose: 'x', render: () => null })\n`
    for (const line of [
      "import { getPayload } from 'payload'",
      "import config from '@payload-config'",
      "import { findPosts } from '@/modules/news'",
      "import { headers } from 'next/headers'",
      "import 'server-only'",
    ]) {
      expect(() => readExamples(`${line}\n${body}`, FILE), line).toThrow(/may not import/)
    }
    expect(() =>
      readExamples(
        `export const A = defineExample({ purpose: 'x', render: () => <p>{process.env.SECRET}</p> })\n`,
        FILE,
      ),
    ).toThrow(/A reads process\.env/)
    expect(() =>
      readExamples(
        `export const A = defineExample({ purpose: 'x', render: () => <p>{String(fetch('/x'))}</p> })\n`,
        FILE,
      ),
    ).toThrow(/A calls fetch/)
  })
})

const component = (name, file, extra = {}) => ({
  name,
  file,
  description: `${name} does a thing.`,
  props: [
    {
      name: 'tone',
      type: '"calm" | "loud"',
      optional: true,
      doc: 'How it sounds',
      variant: true,
      options: ['calm', 'loud'],
    },
    { name: 'id', type: 'string', optional: false, doc: '', variant: false, options: null },
  ],
  inherited: 2,
  parts: [],
  ...extra,
})

const THING = component('Thing', 'src/platform/ui/Thing.tsx')
const PART = component('ThingPart', 'src/platform/ui/Thing.tsx')
const OTHER = component('Other', 'src/platform/ui/Other.tsx')
const groups = [
  { slug: 'things', title: 'Things', components: [THING, PART] },
  { slug: 'others', title: 'Others', components: [OTHER] },
]
const users = new Map([
  ['Thing', ['src/modules/a/ui/A.tsx', 'src/app/b/page.tsx']],
  ['ThingPart', []],
  ['Other', ['src/modules/c/ui/C.tsx']],
])
const files = new Map([[FILE, EXAMPLES]])
const build = (overrides = {}) =>
  buildShowcaseIndex({
    groups,
    users,
    readFile: (file) => files.get(file),
    exampleFiles: [FILE],
    ...overrides,
  })

describe('buildShowcaseIndex', () => {
  it('lists every component in its group with its description, props, variants and usage count', () => {
    const { components } = build()

    expect(components.map((c) => [c.group, c.name])).toEqual([
      ['things', 'Thing'],
      ['things', 'ThingPart'],
      ['others', 'Other'],
    ])
    expect(components[0]).toMatchObject({
      groupTitle: 'Things',
      file: 'src/platform/ui/Thing.tsx',
      description: 'Thing does a thing.',
      inheritedProps: 2,
      parts: [],
      usedBy: { count: 2, files: ['src/modules/a/ui/A.tsx', 'src/app/b/page.tsx'] },
    })
    expect(components[0].props).toEqual([
      {
        name: 'tone',
        type: '"calm" | "loud"',
        optional: true,
        doc: 'How it sounds',
        variant: true,
        options: ['calm', 'loud'],
      },
      { name: 'id', type: 'string', optional: false, doc: '', variant: false, options: null },
    ])
    expect(components[1].usedBy).toEqual({ count: 0, files: [] })
  })

  it('gives a component the examples that name it, and the file name by default', () => {
    const { components } = build()
    const [thing, part, other] = components

    expect(thing.examples.file).toBe(FILE)
    expect(thing.examples.items.map((e) => e.name)).toEqual(['Plain', 'WithSettings'])
    expect(part.examples.items.map((e) => e.name)).toEqual(['WithSettings'])
    expect(other.examples).toBeNull()
  })

  it('lists a component with no examples as missing, in the coverage', () => {
    expect(build().coverage).toEqual({ total: 3, withExamples: 2, missing: ['Other'] })
  })

  it('fails on an examples file for no component, and on an example for a component not in its file', () => {
    expect(() => build({ exampleFiles: [FILE, 'src/platform/ui/Lost.examples.tsx'] })).toThrow(
      /Lost\.examples\.tsx is beside no component file/,
    )
    const stray = EXAMPLES.replace("'ThingPart'", "'Nowhere'")
    expect(() => build({ readFile: (file) => (file === FILE ? stray : undefined) })).toThrow(
      /WithSettings names Nowhere, which Thing\.tsx does not export/,
    )
  })

  it('is the same text every time, with the generated notice first', () => {
    const text = renderShowcaseIndex(build())

    expect(text).toBe(renderShowcaseIndex(build()))
    expect(text.endsWith('\n')).toBe(true)
    const parsed = JSON.parse(text)
    expect(Object.keys(parsed)).toEqual(['generated', 'coverage', 'components'])
    expect(parsed.generated).toMatch(/npm run docs:generate/)
  })
})
