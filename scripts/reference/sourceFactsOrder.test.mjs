import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { findDefinitions, findPluginConfigurers } from './sourceFacts.mjs'
import { createFixture } from './testProgram.mjs'

const fixture = createFixture('reference-source-facts-order-')
const { write, load, root } = fixture
let program

beforeAll(() => {
  // Written out of order on purpose: every list is sorted, whatever order the program read them in
  const type = (slug) => `export const config = { slug: '${slug}', fields: [] }\n`
  write('src/modules/zeta/cms/type.ts', type('shared'))
  write('src/modules/alpha/cms/type.ts', type('shared'))
  write(
    'src/payload.config.ts',
    `import { zetaOptions } from '@/modules/zeta/cms'
import { alphaOptions } from '@/modules/alpha/cms'
import { pluginZ } from '@payloadcms/plugin-z'
import { pluginA } from '@payloadcms/plugin-a'
pluginZ({ first: zetaOptions, second: alphaOptions })
pluginA({ only: alphaOptions })
`,
  )
  program = load()
}, 60_000)

afterAll(() => fixture.cleanup())

describe('the order of the source facts (#1461)', () => {
  it('lists the files that define a type by path', () => {
    expect(findDefinitions(program, root).get('shared')).toEqual([
      'src/modules/alpha/cms/type.ts',
      'src/modules/zeta/cms/type.ts',
    ])
  })

  it('lists the plugins by name, each with its modules by name', () => {
    expect([...findPluginConfigurers(program, root, 'src/payload.config.ts')]).toEqual([
      ['@payloadcms/plugin-a', ['alpha']],
      ['@payloadcms/plugin-z', ['alpha', 'zeta']],
    ])
  })
})
