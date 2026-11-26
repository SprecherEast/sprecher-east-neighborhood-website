/**
 * What the source imports (#1462): which module or shared area builds on which, and which outside
 * packages each part uses. Read from the import lines of the source files given. Pure.
 */
import { makeEdge, makeNode, nodeId } from './graph.mjs'

const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)['"]([^'"]+)['"]/g
const LOCAL_AREA = /^@\/(modules|platform)\/([^/]+)/
const TEST_FILE = /\.(test|spec|stories)\.[a-z]+$|\/testing\//

const withoutComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

/** Every module specifier a file imports, in order of appearance. */
export function importSpecifiers(text) {
  return [...withoutComments(text).matchAll(SPECIFIER)].map(([, specifier]) => specifier)
}

/** The package a specifier comes from, or null for a local path, an alias or a Node built-in. */
export function packageOf(specifier) {
  if (/^(\.|@\/|node:)/.test(specifier)) return null
  const parts = specifier.split('/')
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
}

/**
 * `{ nodes, edges, gaps }`. `sources` are `{ file, text }` of the files under `src/`, `dependencies`
 * the runtime dependencies of package.json, `areaIds` the ids of the modules and shared areas.
 */
export function buildImports({ sources, dependencies, ownerOf, areaIds, siteId }) {
  const counts = new Map()
  const bump = (from, to, type) => {
    const key = `${from}\0${to}\0${type}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const used = new Set()

  for (const { file, text } of sources) {
    if (TEST_FILE.test(file)) continue
    const from = ownerOf(file)?.top ?? siteId
    for (const specifier of new Set(importSpecifiers(text))) {
      const local = LOCAL_AREA.exec(specifier)
      if (local) {
        const target = nodeId(local[1] === 'modules' ? 'module' : 'platform-area', local[2])
        if (target !== from && from !== siteId && areaIds.includes(target))
          bump(from, target, 'uses')
        continue
      }
      const name = packageOf(specifier)
      if (name && Object.hasOwn(dependencies, name)) {
        used.add(name)
        bump(from, nodeId('library', name), 'uses')
      }
    }
  }

  const nodes = [...used].sort().map((name) =>
    makeNode({
      id: nodeId('library', name),
      type: 'library',
      name,
      summary: '',
      path: 'package.json',
      facts: [{ label: 'Version', value: dependencies[name] }],
    }),
  )
  const edges = [...counts].map(([key, count]) => {
    const [from, to, type] = key.split('\0')
    return makeEdge({ from, to, type, count })
  })
  return { nodes, edges, gaps: [] }
}
