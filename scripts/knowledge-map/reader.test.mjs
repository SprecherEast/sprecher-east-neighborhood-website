import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'

import { readRepository } from './reader.mjs'

const made = []
afterAll(() => {
  for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

function repository(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-map-reader-'))
  made.push(root)
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    fs.writeFileSync(path.join(root, file), text)
  }
  execFileSync('git', ['init', '-q'], { cwd: root })
  return root
}

const PAGE =
  "import { events } from '@/modules/events'\nexport const revalidate = 600\nexport default function Page() {}\n"

describe('readRepository', () => {
  const root = repository({
    'package.json': JSON.stringify({ dependencies: { zod: '^4.0.0' } }),
    'docs/knowledge/map.json': '[]',
    'docs/knowledge/note-schema.json': fs.readFileSync('docs/knowledge/note-schema.json', 'utf8'),
    'src/app/(frontend)/events/page.tsx': PAGE,
    'src/modules/events/README.md': '# Events\n',
    '.env.local': 'SECRET=1',
    '.gitignore': '.env*\n',
  })
  const repo = readRepository(root)

  it('lists the files git tracks or would, leaving out an ignored one', () => {
    expect(repo.files).toContain('src/modules/events/README.md')
    expect(repo.files).not.toContain('.env.local')
  })

  it('reads a file by its repository path, and says nothing for a missing one', () => {
    expect(repo.read('src/modules/events/README.md')).toBe('# Events\n')
    expect(repo.read('nope.md')).toBeUndefined()
  })

  it('gives the schema, the map, the package and the routes', () => {
    expect(repo.schema.version).toBe(1)
    expect(repo.mapJson).toBe('[]')
    expect(repo.packageJson.dependencies).toEqual({ zod: '^4.0.0' })
    expect(repo.routes).toMatchObject([
      { url: '/events', kind: 'page', entries: ['@/modules/events'], revalidate: '600' },
    ])
  })
})
