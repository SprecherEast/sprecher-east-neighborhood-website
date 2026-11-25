import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { findPluginConfigurers, findServerActions } from './sourceFacts.mjs'
import { createFixture } from './testProgram.mjs'

const fixture = createFixture('reference-source-facts-edges-')
const { write, load, root } = fixture
let program

beforeAll(() => {
  // Written out of order on purpose: the list is sorted by file, then by name
  write(
    'src/modules/zeta/actions.ts',
    `'use server'
export async function second() {}
export async function first() {}
export let pending: () => void
export const { picked } = { picked: async () => {} }
export const value = 3
`,
  )
  write('src/modules/alpha/actions.ts', "'use server'\nexport async function zzz() {}\n")
  write(
    'src/modules/beta/inline.ts',
    `declare function register(fn: () => void): void
register(async () => {
  'use server'
})
export default async function () {
  'use server'
}
export const handlers = {
  'not-a-name': async () => {
    'use server'
  },
  named: async () => {
    'use server'
  },
}
`,
  )
  write(
    'src/payload.config.ts',
    [
      "import './styles.css'",
      "import type { NewsOptions } from '@/modules/news/cms'",
      "import * as everything from '@/modules/events/cms'",
      "import { plugin } from '@payloadcms/plugin-x'",
      "import { options } from '@/modules/contact/cms'",
      // a path that only contains the alias is no module of the site
      "import { stray } from '../@/modules/elsewhere/cms'",
      'declare const config: { plugin: () => void }',
      'export const plugins = [',
      '  plugin({ a: {} as NewsOptions, b: everything, ...options, c: stray }),',
      '  config.plugin(),',
      ']',
    ].join('\n'),
  )
  program = load()
}, 60_000)

afterAll(() => fixture.cleanup())

describe('findServerActions edge cases (#1461)', () => {
  it('lists the actions sorted by file, then by name', () => {
    const found = findServerActions(program, root).map((a) => [a.file, a.name])
    expect(found).toEqual([
      ['src/modules/alpha/actions.ts', 'zzz'],
      ['src/modules/beta/inline.ts', 'named'],
      ['src/modules/zeta/actions.ts', 'first'],
      ['src/modules/zeta/actions.ts', 'second'],
    ])
  })

  it('lists no exported value that is not a function, and no function without a plain name', () => {
    const names = findServerActions(program, root).map((a) => a.name)
    expect(names).not.toContain('pending')
    expect(names).not.toContain('picked')
    expect(names).not.toContain('value')
    expect(names).not.toContain('not-a-name')
  })
})

describe('findPluginConfigurers edge cases (#1461)', () => {
  it('reads named and default imports of modules, and skips type imports, side effects, namespace imports and plain calls', () => {
    expect(findPluginConfigurers(program, root, 'src/payload.config.ts')).toEqual(
      new Map([['@payloadcms/plugin-x', ['contact']]]),
    )
  })

  it('finds none when the config file is not in the program', () => {
    expect(findPluginConfigurers(program, root, 'src/missing.config.ts')).toEqual(new Map())
  })
})
