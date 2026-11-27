import { describe, expect, it } from 'vitest'

import { renderCatalog } from './catalog.mjs'
import { inputs } from './fixture.mjs'
import { scanGraph } from './scan.mjs'

describe('renderCatalog', () => {
  const { graph } = scanGraph(inputs())
  const text = renderCatalog(graph)

  it('says it is generated, and how to rebuild it', () => {
    expect(text).toMatch(/^# System map catalog/)
    expect(text).toContain('npm run knowledge:map')
  })

  it('lists each module and shared area with its summary and what it holds', () => {
    expect(text).toContain('## Modules and shared areas')
    expect(text).toMatch(
      /- \*\*Events\*\* \(module\): the calendar and its listings\.[^`]*`src\/modules\/events\/README\.md`/,
    )
    expect(text).toMatch(/- \*\*UI kit\*\* \(shared area\): the shared components\./)
  })

  it('lists the content types, the AI agent tools and the scheduled tasks', () => {
    expect(text).toContain('## Content types')
    expect(text).toMatch(/- `events` \(collection\)/)
    expect(text).toContain('## AI agent tools')
    expect(text).toContain('`findEvents`')
    expect(text).toContain('## Scheduled tasks')
    expect(text).toContain('Weekday scout')
  })

  it('lists how we work by kind', () => {
    expect(text).toContain('## How we work')
    expect(text).toContain('`wrapped`')
  })

  it('writes a count in the singular for one, and shortens a long summary to its first sentence', () => {
    const long = {
      ...graph,
      nodes: graph.nodes.map((n) =>
        n.id === 'mcp-tool:findEvents'
          ? { ...n, summary: `Published events. ${'More words. '.repeat(30)}` }
          : n,
      ),
    }
    const out = renderCatalog(long)
    expect(out).toMatch(/Holds 1 content type,/)
    expect(out).toContain('- `findEvents`: Published events. `src/')
  })

  it('is the same text every time, ending with one newline', () => {
    expect(renderCatalog(graph)).toBe(text)
    expect(text.endsWith('\n')).toBe(true)
    expect(text.endsWith('\n\n')).toBe(false)
  })

  it('counts what it does not list, so a reader knows what the graph holds', () => {
    expect(text).toMatch(/\d+ nodes and \d+ relationships/)
  })
})
