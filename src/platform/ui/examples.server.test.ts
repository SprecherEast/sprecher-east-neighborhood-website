// @vitest-environment node
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { renderOnServer } from './testing/renderOnServer'

const ROOT = join(import.meta.dirname, '../../..')
const FOLDERS = ['src/platform/ui', 'src/platform/richtext']
// A server examples file is drawn by a server page; a client one is drawn inside a client component
const SERVER_FILES = FOLDERS.flatMap((folder) =>
  (readdirSync(join(ROOT, folder), { recursive: true, encoding: 'utf8' }) as string[])
    .filter((file) => file.endsWith('.examples.tsx'))
    .map((file) => `${folder}/${file}`),
).sort()

describe('server examples (#1532)', () => {
  it('are drawn by the framework’s server renderer, as they start and with each setting changed, with no function passed to a client component', async () => {
    expect(SERVER_FILES.length).toBeGreaterThan(0)

    expect(await renderOnServer(SERVER_FILES)).toEqual([])
  }, 180_000)

  it('refuses a function passed across the boundary: a handler on an element, a click guard', async () => {
    const problems = await renderOnServer(['src/platform/ui/testing/handlerFixture.tsx'])

    expect(problems.map((p) => [p.name, p.problem?.slice(0, 40)])).toEqual([
      ['Handler', 'Event handlers cannot be passed to Clien'],
    ])
  }, 180_000)
})
