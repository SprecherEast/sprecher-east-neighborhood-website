import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { execute } from './cli.mjs'
import { inputs } from './fixture.mjs'

const made = []
afterEach(() => {
  for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

const setup = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-map-cli-'))
  made.push(root)
  fs.mkdirSync(path.join(root, 'docs/knowledge'), { recursive: true })
  const lines = []
  const run = (argv, load = async () => inputs()) =>
    execute({
      argv,
      root,
      load,
      log: (line) => lines.push(line),
      run: () => {
        throw new Error('offline')
      },
      date: '2026-11-26',
    })
  return { root, lines, run }
}
const GRAPH = 'docs/knowledge/graph.json'
const CATALOG = 'docs/knowledge/catalog.md'

describe('execute', () => {
  it('writes the graph and the catalog, and writes the same files again on a second run', async () => {
    const { root, run } = setup()
    expect(await run([])).toBe(0)
    const first = [GRAPH, CATALOG].map((f) => fs.readFileSync(path.join(root, f), 'utf8'))
    expect(JSON.parse(first[0]).nodes.length).toBeGreaterThan(10)
    expect(first[1]).toMatch(/^# System map catalog/)
    expect(await run([])).toBe(0)
    expect([GRAPH, CATALOG].map((f) => fs.readFileSync(path.join(root, f), 'utf8'))).toEqual(first)
  })

  it('checks that the committed files match, and fails naming the command when one does not', async () => {
    const { root, lines, run } = setup()
    await run([])
    expect(await run(['--check'])).toBe(0)
    fs.appendFileSync(path.join(root, CATALOG), 'edited\n')
    expect(await run(['--check'])).toBe(1)
    expect(lines.join('\n')).toContain('docs/knowledge/catalog.md is out of date')
    expect(lines.join('\n')).toContain('npm run knowledge:map')
  })

  it('fails and writes nothing when a node path does not exist, naming the node and the path', async () => {
    const { root, lines, run } = setup()
    const broken = inputs()
    broken.files = broken.files.filter((f) => f !== 'src/platform/ui/Button.tsx')
    expect(await run([], async () => broken)).toBe(1)
    expect(lines.join('\n')).toContain('shared-component:Button')
    expect(lines.join('\n')).toContain('src/platform/ui/Button.tsx')
    expect(fs.existsSync(path.join(root, GRAPH))).toBe(false)
  })

  it('prints the gaps by kind', async () => {
    const { lines, run } = setup()
    await run([])
    expect(lines.join('\n')).toMatch(/Gaps: \d+/)
  })

  it('writes the extras from the committed graph, and an empty marked snapshot offline', async () => {
    const { root, run } = setup()
    await run([])
    expect(await run(['--extras'])).toBe(0)
    const snapshot = JSON.parse(
      fs.readFileSync(path.join(root, '.knowledge-map/snapshot.json'), 'utf8'),
    )
    expect(snapshot).toMatchObject({ available: false, date: '2026-11-26' })
  })

  it('does not read the committed graph for a plain run, so the extras never reach it', async () => {
    const { root, run } = setup()
    await run([])
    await run(['--extras'])
    const graph = fs.readFileSync(path.join(root, GRAPH), 'utf8')
    expect(graph).not.toContain('snapshot')
    expect(graph).not.toContain('"sha"')
  })
})
