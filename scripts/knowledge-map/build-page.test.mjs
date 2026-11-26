import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { COMMAND, MODULES, build, readInputs, renderPage, scriptJson } from './build-page.mjs'
import { TEST_GRAPH } from './page/testGraph.mjs'

const root = process.cwd()
const parts = () => {
  const inputs = readInputs(root)
  return inputs.parts
}
const page = (graph = TEST_GRAPH, extra = {}) =>
  renderPage({ graph, history: null, snapshot: null, parts: parts(), date: '2026-11-26', ...extra })

describe('renderPage (#1463)', () => {
  it('bundles every page module, and no module is left out', () => {
    const files = fs
      .readdirSync('scripts/knowledge-map/page')
      .filter((f) => f.endsWith('.mjs') && !f.endsWith('.test.mjs'))
    const left = files.filter(
      (f) => !MODULES.includes(f) && !['bundle.mjs', 'testGraph.mjs'].includes(f),
    )
    expect(left).toEqual([])
  })

  it('makes one self-contained file: no outside script, style, font or image, and no request in its code', () => {
    const html = page()
    expect(html).not.toMatch(/<script[^>]+src=/i)
    expect(html).not.toMatch(/<link[^>]+href=/i)
    expect(html).not.toMatch(/@import|url\(\s*['"]?https?:/i)
    expect(html).not.toMatch(/<(img|iframe|video|audio|embed|object)\b/i)
    const code = parts()
      .modules.map(([, source]) => source)
      .join('\n')
    for (const api of [
      'fetch(',
      'XMLHttpRequest',
      'WebSocket',
      'sendBeacon',
      'EventSource',
      'import(',
      'importScripts',
      'new Worker',
    ]) {
      expect(code).not.toContain(api)
    }
  })

  it('keeps the page out of search engines and says what it was built from and how to rebuild', () => {
    const html = page()
    expect(html).toContain('<meta name="robots" content="noindex, nofollow" />')
    expect(html).toContain(JSON.stringify(COMMAND).slice(1, -1))
    expect(html).toContain('"date":"2026-11-26"')
  })

  it('puts the site\u2019s theme tokens in the page rather than its own copies', () => {
    const html = page()
    const theme = fs.readFileSync('src/themes/default/theme.css', 'utf8')
    expect(html).toContain(theme)
    expect(html).toContain("[data-theme='dark']")
  })

  it('cannot be broken out of by text in the graph', () => {
    const hostile = {
      ...TEST_GRAPH,
      nodes: TEST_GRAPH.nodes.map((n, i) =>
        i === 1 ? { ...n, summary: '</script><img src=x onerror=alert(1)>\u2028' } : n,
      ),
    }
    const html = page(hostile)
    expect(html.match(/<\/script>/g)).toHaveLength(2)
    expect(html).not.toContain('<img src=x')
    expect(scriptJson({ a: '</script><!--' })).toBe('{"a":"\\u003c/script>\\u003c!--"}')
    expect(JSON.parse(scriptJson({ a: '</script>\u2028' })).a).toBe('</script>\u2028')
  })

  it('refuses a repository name that is not a plain name', () => {
    expect(() => page({ ...TEST_GRAPH, repository: { owner: 'a"><script>', name: 'b' } })).toThrow(
      /plain name/,
    )
  })

  it('marks missing history and snapshot as empty, never failing', () => {
    const html = page()
    expect(html).toContain('"available":false')
  })
})

describe('build (#1463)', () => {
  it('writes the page to the file asked for, and says when the graph is missing', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'map-page-'))
    try {
      expect(() => build({ root: dir })).toThrow(/knowledge:map/)
      const out = build({ root, out: path.join(dir, 'nested', 'index.html'), date: '2026-11-26' })
      expect(fs.readFileSync(out, 'utf8')).toContain('<canvas id="map"')
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})
