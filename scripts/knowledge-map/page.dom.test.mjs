import fs from 'node:fs'

import axe from 'axe-core'
import { JSDOM } from 'jsdom'
import { afterEach, describe, expect, it } from 'vitest'

import { readInputs, renderPage } from './build-page.mjs'
import { TEST_GRAPH } from './page/testGraph.mjs'

const windows = []
afterEach(() => windows.splice(0).forEach((w) => w.close()))

/** The built page running in jsdom, which has no canvas: a recording stand-in takes its place. */
function open({ dark = false, history = null, snapshot = null } = {}) {
  const html = renderPage({
    graph: TEST_GRAPH,
    history,
    snapshot,
    parts: readInputs(process.cwd()).parts,
    date: '2026-11-26',
  })
  const requests = []
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://dev.example/system-map/',
    beforeParse(window) {
      const ctx = new Proxy(
        {},
        {
          get: (_t, name) => (name === 'measureText' ? () => ({ width: 10 }) : () => {}),
          set: () => true,
        },
      )
      window.HTMLCanvasElement.prototype.getContext = () => ctx
      window.HTMLCanvasElement.prototype.setPointerCapture = () => {}
      window.HTMLDialogElement.prototype.showModal = function () {
        this.open = true
      }
      window.HTMLDialogElement.prototype.close = function () {
        this.open = false
      }
      window.ResizeObserver = class {
        observe() {}
      }
      window.matchMedia = (q) => ({
        matches: q.includes('dark') ? dark : q.includes('reduce'),
        addEventListener() {},
        removeEventListener() {},
      })
      window.fetch = (...a) => requests.push(a)
      window.XMLHttpRequest = class {
        open(...a) {
          requests.push(a)
        }
      }
    },
  })
  windows.push(dom.window)
  return { window: dom.window, document: dom.window.document, requests }
}
const press = (w, key, target = w.document.body) =>
  target.dispatchEvent(new w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
const click = (w, el) => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }))

describe('the system map page in a browser (#1463)', () => {
  it('opens on the overview, ready, with a footer saying what it was built from', () => {
    const { document } = open()
    expect(document.getElementById('app').getAttribute('aria-busy')).toBe('false')
    expect(document.getElementById('loading').hidden).toBe(true)
    expect(document.getElementById('counts').textContent).toBe(
      '4 of 9 nodes shown · 11 connections',
    )
    const footer = document.getElementById('footer-text').textContent
    expect(footer).toContain('2026-11-26')
    expect(footer).toContain('graph.json (9 nodes, 11 connections)')
    expect(footer).toContain('npm run knowledge:page')
  })

  it('makes no network request when it loads or when a control is used', () => {
    const { window, document, requests } = open()
    click(window, document.getElementById('layer-docs'))
    press(window, 'e')
    expect(requests).toEqual([])
  })

  it('has a switch for each layer, node type and module, with the layer’s own line style next to it', () => {
    const { document } = open()
    for (const key of ['structure', 'docs', 'data', 'code'])
      expect(document.getElementById(`layer-${key}`)).not.toBeNull()
    for (const type of Object.keys(TEST_GRAPH.nodeTypes))
      expect(document.getElementById(`type-${type}`)).not.toBeNull()
    expect(document.getElementById('module-events')).not.toBeNull()
    expect(document.querySelectorAll('#layer-docs + label canvas')).toHaveLength(1)
  })

  it('starts with the starting layers on and the rest off, and a click switches one', () => {
    const { window, document } = open()
    expect(document.getElementById('layer-docs').checked).toBe(false)
    expect(document.getElementById('layer-structure').checked).toBe(true)
    click(window, document.getElementById('layer-docs'))
    expect(document.getElementById('layer-docs').checked).toBe(true)
  })

  it('shows one module alone', () => {
    const { window, document } = open()
    press(window, 'e')
    expect(document.getElementById('counts').textContent).toContain('9 of 9')
    click(window, document.querySelector('button[aria-label="Show only news"]'))
    expect(document.getElementById('counts').textContent).toContain('3 of 9')
  })

  it('finds a node by search, selects it, and fills the side panel; Escape clears it', () => {
    const { window, document } = open()
    const input = document.getElementById('search')
    input.value = 'venues'
    input.dispatchEvent(new window.Event('input', { bubbles: true }))
    expect(document.querySelectorAll('#results li button')).toHaveLength(1)
    input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    const detail = document.getElementById('detail')
    expect(detail.hidden).toBe(false)
    expect(detail.querySelector('h2').textContent).toBe('venues')
    expect(detail.textContent).toContain('Open on GitHub')
    expect(
      detail.querySelector('a[href^="https://github.com/Owner/repo/tree/main/"]'),
    ).not.toBeNull()
    press(window, 'Escape')
    expect(detail.hidden).toBe(true)
  })

  it('lists typed connections in the panel, each one clickable', () => {
    const { window, document } = open()
    press(window, 'e')
    const input = document.getElementById('search')
    input.value = 'events-collection'
    input.dispatchEvent(new window.Event('input', { bubbles: true }))
    input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    const links = [...document.querySelectorAll('#detail .conns button')].map((b) => b.textContent)
    expect(links).toEqual(expect.arrayContaining(['venues', 'posts']))
    click(
      window,
      [...document.querySelectorAll('#detail .conns button')].find(
        (b) => b.textContent === 'venues',
      ),
    )
    expect(document.querySelector('#detail h2').textContent).toBe('venues')
  })

  it('shows open tasks as of the snapshot date with a live search link, and a clear note when there is none', () => {
    const snapshot = {
      available: true,
      date: '2026-11-25',
      issues: 1,
      nodes: {
        'collection:venues': [
          {
            number: 7,
            title: 'Fix venues',
            url: 'https://github.com/Owner/repo/issues/7',
            labels: [],
          },
        ],
      },
    }
    const { window, document } = open({ snapshot })
    press(window, 'e')
    const input = document.getElementById('search')
    input.value = 'venues'
    input.dispatchEvent(new window.Event('input', { bubbles: true }))
    input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    const text = document.getElementById('detail').textContent
    expect(text).toContain('As of 2026-11-25: 1 open issue.')
    expect(text).toContain('#7 Fix venues')
    expect(document.querySelector('#detail a[href*="issues?q="]')).not.toBeNull()
    expect(open().document.body.textContent).toContain('No snapshot')
  })

  it('marks what changed since a chosen build, and lists it', () => {
    const history = {
      available: true,
      head: 'b',
      nodes: {},
      commits: [
        { sha: 'b', date: '2026-11-26T10:00:00Z', subject: 'Second', nodes: ['module:news'] },
        { sha: 'a', date: '2026-11-25T10:00:00Z', subject: 'First', nodes: ['module:events'] },
      ],
    }
    const { window, document } = open({ history })
    const since = document.getElementById('since')
    since.value = 'a'
    since.dispatchEvent(new window.Event('change', { bubbles: true }))
    expect([...document.querySelectorAll('#changes li button')].map((b) => b.textContent)).toEqual([
      expect.stringContaining('news'),
    ])
    expect(open().document.getElementById('since').disabled).toBe(true)
  })

  it('has a shortcut for each control, listed in the how-to overlay', () => {
    const { window, document } = open()
    const help = document.getElementById('help-body').textContent
    for (const key of ['Search', 'Fit', 'Expand', 'Collapse', 'layout', 'path', 'Escape'])
      expect(help).toContain(key)
    press(window, '?')
    expect(document.getElementById('help').open).toBe(true)
    press(window, 'l')
    expect(document.querySelector('button[aria-pressed="true"]').textContent).toBe('Mind map')
  })

  it('follows the reader’s light or dark setting and can switch it', () => {
    expect(open({ dark: true }).document.documentElement.dataset.theme).toBe('dark')
    const { window, document } = open()
    expect(document.documentElement.dataset.theme).toBe('light')
    press(window, 't')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('lists the shown nodes as an outline a keyboard or screen reader can walk', () => {
    const { window, document } = open()
    const buttons = () =>
      [...document.querySelectorAll('#outline button.link')].map((b) => b.firstChild.textContent)
    expect(buttons()).toEqual(expect.arrayContaining(['Sprecher East', 'events', 'news', 'ui']))
    click(window, document.querySelector('#outline button[aria-label="Expand events"]'))
    expect(buttons()).toContain('venues')
  })

  it('passes the automated accessibility check (WCAG 2.1 A and AA rules; colours are checked separately)', async () => {
    const { window, document } = open()
    press(window, 'e')
    window.eval(axe.source)
    const result = await window.axe.run(document, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'],
      },
      rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
    })
    expect(
      result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`),
    ).toEqual([])
  })
})

describe('the text colours (#1463)', () => {
  it('draws every text colour from the theme tokens, none of its own', () => {
    const css = fs.readFileSync('scripts/knowledge-map/page/map.css', 'utf8')
    expect(css.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i)
  })
})
