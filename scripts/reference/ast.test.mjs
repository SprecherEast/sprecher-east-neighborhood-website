import ts from 'typescript'
import { describe, expect, it } from 'vitest'

import { isSource, isTestFile, property, propertyName, valueOf, valueProperties } from './ast.mjs'

const objectOf = (text) => {
  const file = ts.createSourceFile('a.ts', `const x = ${text}`, ts.ScriptTarget.Latest, true)
  return file.statements[0].declarationList.declarations[0].initializer
}

describe('isTestFile and isSource', () => {
  it('counts tests, contract files and folders of test helpers as tests', () => {
    expect(isTestFile('src/a/b.test.ts')).toBe(true)
    expect(isTestFile('src/a/b.spec.mjs')).toBe(true)
    expect(isTestFile('src/a/b.contract.tsx')).toBe(true)
    expect(isTestFile('src/platform/testing/helper.ts')).toBe(true)
    expect(isTestFile('src/a/b.ts')).toBe(false)
    // only a dot before the word and a script extension at the end make a test file
    expect(isTestFile('src/a/attest.ts')).toBe(false)
    expect(isTestFile('src/a/b.test.ts.md')).toBe(false)
    expect(isTestFile('src/a/b.tests.ts')).toBe(false)
  })

  it('counts a file of src/ that is no test and no declaration file as source', () => {
    expect(isSource('/repo/src/a/b.ts', '/repo')).toBe(true)
    expect(isSource('/repo/scripts/b.ts', '/repo')).toBe(false)
    expect(isSource('/repo/src/a/b.test.ts', '/repo')).toBe(false)
    expect(isSource('/repo/src/platform/testing/h.ts', '/repo')).toBe(false)
    expect(isSource('/repo/src/a/types.d.ts', '/repo')).toBe(false)
  })
})

describe('object properties', () => {
  const node = objectOf("{ a: 1, 'b': 2, [c]: 3, 4: 5, d, e() {}, ...rest, get f() { return 1 } }")

  it('keeps the properties that carry a value: assignments, shorthands and methods', () => {
    expect(valueProperties(node).map((p) => p.name.getText())).toEqual([
      'a',
      "'b'",
      '[c]',
      '4',
      'd',
      'e',
    ])
  })

  it('names a property by an identifier or a string, and not by a computed or number key', () => {
    expect(valueProperties(node).map(propertyName)).toEqual([
      'a',
      'b',
      undefined,
      undefined,
      'd',
      'e',
    ])
  })

  it('finds a property by name, and gives the expression that holds its value', () => {
    expect(property(node, 'b')).toBeDefined()
    expect(property(node, 'missing')).toBeUndefined()
    expect(valueOf(property(node, 'a')).getText()).toBe('1')
    expect(valueOf(property(node, 'd')).getText()).toBe('d')
  })
})
