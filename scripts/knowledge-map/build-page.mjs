#!/usr/bin/env node
/**
 * Builds the system map page (#1463): one self-contained HTML file from the scanner's graph
 * (`docs/knowledge/graph.json`), its change history and open-issue snapshot (`.knowledge-map/`),
 * the page's own script, styles and template, and the site's theme tokens. No server and no
 * network request at view time; the file is never edited by hand.
 *
 *   npm run knowledge:page                 write .knowledge-map/system-map/index.html
 *   npm run knowledge:page -- --out <file> write it elsewhere
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { bundle } from './page/bundle.mjs'

export const GRAPH_FILE = 'docs/knowledge/graph.json'
export const EXTRAS_DIR = '.knowledge-map'
export const THEME_FILE = 'src/themes/default/theme.css'
export const DEFAULT_OUT = `${EXTRAS_DIR}/system-map/index.html`
export const COMMAND = 'npm run knowledge:map -- --extras && npm run knowledge:page'

/** The page's script modules, each after the ones it imports. */
export const MODULES = [
  'camera',
  'style',
  'model',
  'view',
  'search',
  'path',
  'changes',
  'links',
  'layout',
  'draw',
  'dom',
  'panels',
  'pointer',
  'app',
].map((name) => `${name}.mjs`)

const NAME = /^[\w.-]+$/

/** JSON that is safe inside a script element: no `</script`, no `<!--`, no line separators. */
export const scriptJson = (value) =>
  JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')

const emptyHistory = {
  available: false,
  reason: 'no history was built',
  head: '',
  nodes: {},
  commits: [],
}
const emptySnapshot = {
  available: false,
  reason: 'no snapshot was built',
  date: '',
  issues: 0,
  nodes: {},
}

/** The page as text. `parts` are the template, the styles, the theme and the modules' sources. */
export function renderPage({ graph, history, snapshot, parts, date }) {
  const { owner, name } = graph.repository
  if (!NAME.test(owner) || !NAME.test(name))
    throw new Error('the repository name in the graph is not a plain name')
  const data = {
    graph,
    history: history ?? emptyHistory,
    snapshot: snapshot ?? emptySnapshot,
    built: { date, command: COMMAND },
  }
  const script = `${bundle(parts.modules)}\n__modules['app.mjs'].startApp(JSON.parse(document.getElementById('map-data').textContent))\n`
  const replacements = {
    '/*THEME*/': parts.theme,
    '/*CSS*/': parts.css,
    '/*DATA*/': scriptJson(data),
    '/*SCRIPT*/': script,
    __OWNER__: owner,
    __REPO__: name,
  }
  return Object.entries(replacements).reduce(
    (text, [key, value]) => text.split(key).join(value),
    parts.template,
  )
}

const readJson = (file) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null)

/** Reads the inputs under `root`; the graph is required, the two extras are optional. */
export function readInputs(root) {
  const graph = readJson(path.join(root, GRAPH_FILE))
  if (graph === null)
    throw new Error(`${GRAPH_FILE} is missing: run \`npm run knowledge:map\` first`)
  const here = path.join(root, 'scripts/knowledge-map/page')
  const read = (file) => fs.readFileSync(file, 'utf8')
  return {
    graph,
    history: readJson(path.join(root, EXTRAS_DIR, 'history.json')),
    snapshot: readJson(path.join(root, EXTRAS_DIR, 'snapshot.json')),
    parts: {
      template: read(path.join(here, 'template.html')),
      css: read(path.join(here, 'map.css')),
      theme: read(path.join(root, THEME_FILE)),
      modules: MODULES.map((file) => [file, read(path.join(here, file))]),
    },
  }
}

/** Builds the page under `root` and writes it to `out`; returns the path written. */
export function build({ root, out = DEFAULT_OUT, date = new Date().toISOString().slice(0, 10) }) {
  const target = path.resolve(root, out)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, renderPage({ ...readInputs(root), date }))
  return target
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
  const at = process.argv.indexOf('--out')
  const out = at > 0 ? process.argv[at + 1] : undefined
  try {
    console.log(`Wrote ${path.relative(root, build({ root, out }))}`)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
