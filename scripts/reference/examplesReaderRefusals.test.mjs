import { describe, expect, it } from 'vitest'

import { FILE, IMPORTS, ONE, read, readExamples, withBody } from './examplesFixture.mjs'

describe('readExamples: what it refuses to read', () => {
  it('refuses a syntax error', () => {
    expect(() =>
      readExamples(
        `${IMPORTS}export const A = defineExample({ purpose: 'x', render: () => <div>\n`,
        FILE,
      ),
    ).toThrow(/syntax error/)
  })

  it('refuses an export that is not an example, however it is written', () => {
    expect(() => read(`export const SIZE = 3\n`)).toThrow(
      /Thing\.examples\.tsx: SIZE is not a defineExample/,
    )
    expect(() => read(`export function f() {}\n`)).toThrow(/f is not a defineExample/)
    expect(() => read(`export let A = ${ONE}\n`)).toThrow(/A must be a const/)
    expect(() => read(`export const A = ${ONE}, B = 3\n`)).toThrow(/one example for each export/)
    expect(() => read(`export const _A = ${ONE}\n`)).toThrow(/_A is not a name an example may have/)
    expect(() => read(`export const $A = ${ONE}\n`)).toThrow(/\$A is not a name/)
    expect(() => read(`export const a = ${ONE}\n`)).toThrow(/a is not a name/)
  })

  it('needs defineExample from the kit, not from another place or another call', () => {
    expect(() =>
      readExamples(`import { defineExample } from 'zod'\nexport const A = ${ONE}\n`, FILE),
    ).toThrow(/imports zod/)
    expect(() =>
      readExamples(`import { defineExample } from './other'\nexport const A = ${ONE}\n`, FILE),
    ).toThrow(/imports \.\/other/)
    expect(() => readExamples(`export const A = ${ONE}\n`, FILE)).toThrow(
      /defineExample comes from \.\/example/,
    )
    expect(() =>
      read(`export const A = someOther({ purpose: 'x', render: () => null })\n`),
    ).toThrow(/A is not a defineExample/)
    expect(() =>
      readExamples(
        `import { defineExample } from '@/platform/ui/example'\nexport const A = ${ONE}\n`,
        FILE,
      ),
    ).not.toThrow()
  })

  it('needs a purpose of one line, up to 120 characters, with something in it', () => {
    expect(() => read(withBody('render: () => null').replace("purpose: 'x', ", ''))).toThrow(
      /A has no purpose/,
    )
    expect(() =>
      read(`export const A = defineExample({ purpose: '', render: () => null })\n`),
    ).toThrow(/A has no purpose/)
    expect(() =>
      read(`export const A = defineExample({ purpose: '   ', render: () => null })\n`),
    ).toThrow(/A has no purpose/)
    expect(() =>
      read(`export const A = defineExample({ purpose: \`a\nb\`, render: () => null })\n`),
    ).toThrow(/A: the purpose is one line/)
    expect(() =>
      read(
        `export const A = defineExample({ purpose: '${'x'.repeat(121)}', render: () => null })\n`,
      ),
    ).toThrow(/A: the purpose is one line/)
    expect(
      read(
        `export const A = defineExample({ purpose: '${'x'.repeat(120)}', render: () => null })\n`,
      ),
    ).toHaveLength(1)
  })

  it('needs a render function, and only the four known entries, each once', () => {
    expect(() => read(`export const A = defineExample({ purpose: 'x' })\n`)).toThrow(
      /A has no render function/,
    )
    expect(() => read(`export const A = defineExample({ purpose: 'x', render: 3 })\n`)).toThrow(
      /A has no render function/,
    )
    expect(() =>
      read(`export const A = defineExample({ purpose: 'x', purpose: 'y', render: () => null })\n`),
    ).toThrow(/A has two purpose entries/)
    expect(() =>
      read(`export const A = defineExample({ purpose: 'x', render: () => null, title: 'T' })\n`),
    ).toThrow(/A has an entry it does not know: title/)
    expect(() =>
      read(`export const A = defineExample({ purpose: 'x', ...rest, render: () => null })\n`),
    ).toThrow(/A: every entry must be written out/)
    expect(() => read(`export const A = defineExample()\n`)).toThrow(/A has no purpose/)
  })

  it('needs `of` to name components', () => {
    expect(read(withBody("of: 'Thing', render: () => null"))[0].of).toBe('Thing')
    for (const of of ['3', '{ a: 1 }', '[]', "['a b']", "''", '[3]']) {
      expect(() => read(withBody(`of: ${of}, render: () => null`)), of).toThrow(
        /A: of must be a component name or a list of them/,
      )
    }
    expect(() => read(withBody('of: SOME, render: () => null'))).toThrow(/A: of must be plain data/)
  })

  it('needs settings that are an object of known kinds, written as plain data', () => {
    const bad = (settings) => () => read(withBody(`settings: ${settings}, render: () => null`))
    expect(bad('{ a: SOMETHING }')).toThrow(/A: settings must be plain data/)
    expect(bad('[]')).toThrow(/A: settings must be an object of settings/)
    expect(bad("{ a: 'x' }")).toThrow(/A: setting a must be an object/)
    expect(bad("{ a: { kind: 'slider', default: 1 } }")).toThrow(/A: setting a has kind slider/)
    expect(bad("{ a: { kind: 'boolean', default: 'no' } }")).toThrow(
      /A: setting a needs a default of its kind/,
    )
    expect(bad("{ a: { kind: 'text', default: 1 } }")).toThrow(
      /A: setting a needs a default of its kind/,
    )
    expect(bad("{ a: { kind: 'choice', options: ['x'], default: 'y' } }")).toThrow(
      /A: setting a has a default that is not one of its options/,
    )
    expect(bad("{ a: { kind: 'choice', options: [], default: 'y' } }")).toThrow(
      /A: setting a needs options/,
    )
    expect(bad("{ a: { kind: 'choice', options: ['x', 'x'], default: 'x' } }")).toThrow(
      /A: setting a has an option twice/,
    )
    expect(bad("{ a: { kind: 'choice', options: [1], default: 'x' } }")).toThrow(
      /A: setting a needs options/,
    )
    expect(bad("{ a: { kind: 'text', default: 'x', options: ['x'] } }")).toThrow(
      /A: setting a has an entry it does not know: options/,
    )
    expect(bad("{ a: { kind: 'text', default: 'x', color: 'red' } }")).toThrow(
      /A: setting a has an entry it does not know: color/,
    )
    expect(bad("{ a: { kind: 'text', default: 'x', description: 3 } }")).toThrow(
      /A: setting a needs a description of text/,
    )
  })

  it('fails on a duplicate link name, with case folded', () => {
    expect(() =>
      read(`export const A = ${ONE}\nexport const Aa = ${ONE}\nexport const AA = ${ONE}\n`),
    ).toThrow(/AA has the same link name as Aa/)
  })
})
