import { describe, expect, it } from 'vitest'

import { buildShowcaseIndex, renderShowcaseIndex } from './showcase.mjs'

const THING = 'src/platform/ui/Thing.examples.tsx'
const THING_CLIENT = 'src/platform/ui/Thing.examples.client.tsx'
const IMPORTS = `import { defineExample } from './example'\nimport { Thing } from './Thing'\n`
const SERVER = `${IMPORTS}
export const Plain = defineExample({
  purpose: 'The ordinary thing',
  render: () => <Thing>Hello</Thing>,
})

export const WithSettings = defineExample({
  purpose: 'A thing whose words can change',
  of: ['Thing', 'ThingPart'],
  settings: { words: { kind: 'text', default: 'Hello' } },
  render: ({ words }) => <Thing>{words}</Thing>,
})
`
const CLIENT = `'use client'\n\n${IMPORTS}
export const Pressed = defineExample({
  purpose: 'A thing that can be pressed',
  render: () => <Thing onPress={() => {}}>Press</Thing>,
})
`

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

const THING_C = component('Thing', 'src/platform/ui/Thing.tsx')
const PART_C = component('ThingPart', 'src/platform/ui/Thing.tsx', {
  parts: [{ name: 'ThingPart.Row', description: 'A row', props: [], inherited: 0 }],
})
const OTHER_C = component('Other', 'src/platform/ui/Other.tsx')
const groups = [
  { slug: 'things', title: 'Things', components: [THING_C, PART_C] },
  { slug: 'others', title: 'Others', components: [OTHER_C] },
]
const users = new Map([
  ['Thing', ['src/modules/a/ui/A.tsx', 'src/app/b/page.tsx']],
  ['ThingPart', []],
  ['Other', ['src/modules/c/ui/C.tsx']],
])
const files = new Map([
  [THING, SERVER],
  [THING_CLIENT, CLIENT],
])
const build = (overrides = {}) =>
  buildShowcaseIndex({
    groups,
    users,
    readFile: (file) => files.get(file),
    exampleFiles: [THING, THING_CLIENT],
    kitFiles: new Set(['src/platform/ui/Button.tsx', THING_C.file, 'src/platform/ui/Other.tsx']),
    ...overrides,
  })

describe('buildShowcaseIndex', () => {
  it('lists every component in its group with its description, props, parts and usage', () => {
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
    expect(components[0].props.map((p) => [p.name, p.options])).toEqual([
      ['tone', ['calm', 'loud']],
      ['id', null],
    ])
    expect(components[1].parts.map((p) => p.name)).toEqual(['ThingPart.Row'])
    expect(components[1].usedBy).toEqual({ count: 0, files: [] })
  })

  it('gives a component the examples that name it, from the server and the client file', () => {
    const [thing, part, other] = build().components

    expect(thing.examples.items.map((e) => [e.name, e.kind, e.file])).toEqual([
      ['Plain', 'server', THING],
      ['WithSettings', 'server', THING],
      ['Pressed', 'client', THING_CLIENT],
    ])
    expect(thing.examples.files).toEqual([THING, THING_CLIENT])
    expect(part.examples.items.map((e) => e.name)).toEqual(['WithSettings'])
    expect(part.examples.files).toEqual([THING])
    expect(other.examples).toBeNull()
  })

  it('gives an example with no `of` to the component named like the file, else the first in it', () => {
    const renamed = [
      {
        slug: 'g',
        title: 'G',
        components: [
          component('First', 'src/platform/ui/Thing.tsx'),
          component('Second', 'src/platform/ui/Thing.tsx'),
        ],
      },
    ]
    const plainOnly = SERVER.split('export const WithSettings')[0]
    const [first, second] = build({
      groups: renamed,
      users: new Map(),
      readFile: (f) => (f === THING ? plainOnly : undefined),
      exampleFiles: [THING],
    }).components.slice(0, 2)

    expect(first.examples.items.map((e) => e.name)).toContain('Plain')
    expect(second.examples).toBeNull()
  })

  it('lists a component with no examples as missing, in the coverage', () => {
    expect(build().coverage).toEqual({ total: 3, withExamples: 2, missing: ['Other'] })
  })

  it('fails on an examples file for no component, server or client', () => {
    for (const lost of ['Lost.examples.tsx', 'Lost.examples.client.tsx']) {
      expect(() => build({ exampleFiles: [THING, `src/platform/ui/${lost}`] })).toThrow(
        new RegExp(`${lost.replace('.', '\\.')} is beside no component file`),
      )
    }
  })

  it('fails on an example for a component not in its file', () => {
    const stray = SERVER.replace("'ThingPart'", "'Nowhere'")

    expect(() => build({ readFile: (f) => (f === THING ? stray : files.get(f)) })).toThrow(
      /WithSettings names Nowhere, which Thing\.tsx does not export/,
    )
  })

  it('fails when the server and the client file give two examples one link name', () => {
    const twin = CLIENT.replace('Pressed', 'Plain')

    expect(() => build({ readFile: (f) => (f === THING_CLIENT ? twin : files.get(f)) })).toThrow(
      /Thing\.examples\.client\.tsx: Plain has the same link name as Plain in src\/platform\/ui\/Thing\.examples\.tsx/,
    )
  })

  it('lets an example import only the component files of the index', () => {
    const outside = SERVER.replace("from './Thing'", "from './Elsewhere'")

    expect(() => build({ readFile: (f) => (f === THING ? outside : files.get(f)) })).toThrow(
      /imports \.\/Elsewhere/,
    )
  })

  it('refuses a relative import of a component that is not on the safe list', () => {
    expect(() => build({ kitFiles: new Set() })).toThrow(/imports \.\/Thing/)
  })

  it('lets an example import a kit component only when it is on the safe list', () => {
    const kit = (name) => `import { x } from '@/platform/ui/${name}'\n${SERVER}`
    const reading = (name) => () =>
      build({ readFile: (f) => (f === THING ? kit(name) : files.get(f)) })

    expect(reading('Button')).not.toThrow()
    expect(reading('AdminBar.client')).toThrow(/imports @\/platform\/ui\/AdminBar\.client/)
    expect(reading('../lib/foo')).toThrow(/imports @\/platform\/ui\/\.\.\/lib\/foo/)
  })

  it('is the same text every time, indented by two, with the generated notice first', () => {
    const text = renderShowcaseIndex(build())

    expect(text).toBe(renderShowcaseIndex(build()))
    expect(text.endsWith('\n')).toBe(true)
    expect(text).toContain('\n  "generated"')
    const parsed = JSON.parse(text)
    expect(Object.keys(parsed)).toEqual(['generated', 'coverage', 'components'])
    expect(parsed.generated).toMatch(/npm run docs:generate/)
  })
})
