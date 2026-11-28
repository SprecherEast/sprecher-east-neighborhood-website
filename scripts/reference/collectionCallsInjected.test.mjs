import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { findCollectionCalls } from './collectionCalls.mjs'
import { createFixture } from './testProgram.mjs'

const fixture = createFixture('reference-collection-injected-')
const { write, load, root } = fixture
let program

beforeAll(() => {
  const api = 'type Api = { find(a: object): void }\ndeclare const req: { payload: Api }\n'
  write(
    'src/modules/a/cms/retention.ts',
    `${api}export const makeTask = ({ keepers }: { keepers: Array<() => void> }) => ({
  slug: 'expire',
  handler: async () => {
    req.payload.find({ collection: 'faq' })
    for (const keeper of keepers) keeper()
  },
})
export function unrelated() {}
`,
  )
  write(
    'src/modules/b/cms/keeper.ts',
    `${api}/** Keeps people with a message. */
export const keepA = async () => {
  req.payload.find({ collection: 'events', overrideAccess: true })
}
export function keepB() {
  req.payload.find({ collection: 'users' })
}
export const notAFunction = 3
`,
  )
  write('src/modules/b/cms.ts', "export { keepA, keepB, notAFunction } from './cms/keeper'\n")
  write(
    'src/payload.config.ts',
    `import { makeTask, unrelated } from '@/modules/a/cms/retention'
import { keepA, keepB, notAFunction } from '@/modules/b/cms'
declare function other(a: object): void
export const tasks = [makeTask({ keepers: [keepA, keepB] , n: notAFunction })]
other({ ignored: keepB })
unrelated()
`,
  )
  program = load()
}, 60_000)

afterAll(() => fixture.cleanup())

describe('functions the config passes into a task (#1461)', () => {
  const calls = (configFile) =>
    findCollectionCalls(program, root, 'src/modules/a/cms/retention.ts', {
      name: 'expire',
      configFile,
      knownSlugs: new Set(['faq', 'events', 'users']),
    })

  it('follows the functions named in a call to the task’s own code, through re-exports', () => {
    expect(calls('src/payload.config.ts').map((c) => [c.collection, c.operations])).toEqual([
      ['events', ['read (access bypassed)']],
      ['faq', ['read (access bypassed)']],
      ['users', ['read (access bypassed)']],
    ])
    expect(calls('src/payload.config.ts')[0].why[0].text).toBe('Keeps people with a message.')
  })

  it('follows nothing without a config file, or when the file is missing', () => {
    expect(calls(undefined).map((c) => c.collection)).toEqual(['faq'])
    expect(calls('src/none.ts').map((c) => c.collection)).toEqual(['faq'])
  })
})
