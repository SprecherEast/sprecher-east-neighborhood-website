import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, describe, expect, it } from 'vitest'

import * as first from './fixtures/first.mjs'
import * as second from './fixtures/second.mjs'
import { createLocator } from './locate.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const { locate, close } = createLocator(root)
afterAll(close)

describe('createLocator', () => {
  it('tells apart two functions with the same name in different files', () => {
    expect(locate(first.sameName)).toBe('scripts/content-types/fixtures/first.mjs')
    expect(locate(second.sameName)).toBe('scripts/content-types/fixtures/second.mjs')
  })

  it('finds the file of an anonymous function', () => {
    expect(locate(first.makeAnonymous())).toBe('scripts/content-types/fixtures/first.mjs')
  })

  it('follows a bound function to the function it wraps', () => {
    expect(locate(second.sameName.bind(null))).toBe('scripts/content-types/fixtures/second.mjs')
  })

  it('does not confuse a sibling folder of the root with the root', () => {
    const sibling = createLocator(`${root}-other`)
    expect(sibling.locate(first.sameName)).toBe('unknown')
    sibling.close()
  })
})
