import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'

// The facts need the loaded Payload config, which the generated reference's own tests cover
vi.mock('../reference/loadFacts.mjs', () => ({ loadFacts: async () => ({ models: [], api: {} }) }))

const { loadInputs } = await import('./load.mjs')

const made = []
afterAll(() => {
  for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

const FILES = {
  'package.json': JSON.stringify({ dependencies: {} }),
  'tsconfig.json': JSON.stringify({
    compilerOptions: { jsx: 'preserve', baseUrl: '.', paths: { '@/*': ['src/*'] } },
    include: ['src'],
  }),
  'docs/knowledge/map.json': '[]',
  'docs/knowledge/note-schema.json': fs.readFileSync('docs/knowledge/note-schema.json', 'utf8'),
  'src/platform/ui/Button.tsx':
    '/** A button. */\nexport function Button(props: { label: string }) {\n  return props.label\n}\n',
  'src/app/(frontend)/page.tsx': 'export default function Page() {\n  return null\n}\n',
  'src/modules/events/ui/Card.tsx':
    "import { Button } from '@/platform/ui/Button'\nexport const x = Button\n",
}

describe('loadInputs', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-map-load-'))
  made.push(root)
  for (const [file, text] of Object.entries(FILES)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    fs.writeFileSync(path.join(root, file), text)
  }
  execFileSync('git', ['init', '-q'], { cwd: root })

  it('joins the repository files with the facts, the components and where they are used', async () => {
    const inputs = await loadInputs(root)
    expect(Object.keys(inputs).sort()).toEqual(
      [
        'components',
        'componentUsers',
        'facts',
        'files',
        'mapJson',
        'packageJson',
        'read',
        'routes',
        'schema',
      ].sort(),
    )
    expect(inputs.files).toContain('src/modules/events/ui/Card.tsx')
    expect(inputs.facts).toEqual({ models: [], api: {} })
    expect(inputs.components.map((c) => c.name)).toEqual(['Button'])
    expect(inputs.components[0]).not.toHaveProperty('symbol')
    expect(inputs.components[0]).toMatchObject({
      file: 'src/platform/ui/Button.tsx',
      description: 'A button.',
    })
    expect(inputs.componentUsers.get('Button')).toEqual(['src/modules/events/ui/Card.tsx'])
  }, 60_000) // the compiler reads its own library files
})
