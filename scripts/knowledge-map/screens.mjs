/**
 * The screens of the map (#1462): a node for each page the visitor opens, grouped into clusters by
 * the first part of the address, each held by the module its screens import; and the Admin screen,
 * which edits every content type. Read from the routes reference rows. Pure.
 *
 * A screen's `module` is the module that holds it, not its only dependency: the module most of the
 * screens under the same first address segment import (alphabetical on a tie). The `uses`
 * relationships name every module a screen imports, so a screen that mixes modules shows them all.
 */
import path from 'node:path'

import { makeEdge, makeNode, nodeId } from './graph.mjs'

const MODULE_ENTRY = /^@\/modules\/([^/]+)/

const firstSegment = (url) => `/${url.split('/')[1] ?? ''}`

/** The folder two or more files share: the longest run of leading folders. */
function commonFolder(files) {
  const folders = files.map((file) => path.posix.dirname(file).split('/'))
  const shared = folders[0].filter((part, index) =>
    folders.every((folder) => folder[index] === part),
  )
  return shared.join('/')
}

/** The module most screens import, alphabetical on a tie; undefined when none import one. */
function dominantModule(screens, moduleIds) {
  const counts = new Map()
  for (const screen of screens) {
    for (const id of screen.modules) counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return [...counts]
    .filter(([id]) => moduleIds.includes(id))
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0]
}

function screenNode(route, modules, owner) {
  return makeNode({
    id: nodeId('screen', route.url),
    type: 'screen',
    name: route.url,
    path: route.file,
    module: owner,
    facts: [
      { label: 'Address', value: route.url },
      { label: 'Rendering', value: route.rendering },
      { label: 'Revalidate (s)', value: route.revalidate },
      { label: 'Pages built ahead', value: route.staticParams ? 'yes' : 'no' },
      { label: 'Metadata', value: route.metadata },
      { label: 'Module entry points', value: route.entries.join(', ') },
    ].filter((fact) => fact.value !== ''),
  })
}

/**
 * `{ nodes, edges, gaps, screenByFile }`. `routes` are the rows of the routes reference,
 * `adminPages` the Admin pages, `moduleIds` the ids of the modules, `contentTypeIds` those of the
 * collections and globals the Admin screen edits.
 */
export function buildScreens({ routes, adminPages, moduleIds, contentTypeIds, siteId }) {
  const pages = routes
    .filter((route) => route.kind === 'page')
    .map((route) => ({
      route,
      modules: [...new Set(route.entries.map((e) => MODULE_ENTRY.exec(e)?.[1]).filter(Boolean))]
        .map((name) => nodeId('module', name))
        .filter((id) => moduleIds.includes(id))
        .sort(),
    }))
  const nodes = []
  const edges = []
  const gaps = []
  const screenByFile = new Map()

  const clusters = new Map()
  for (const page of pages) {
    const key = firstSegment(page.route.url)
    clusters.set(key, [...(clusters.get(key) ?? []), page])
  }

  for (const [segment, members] of clusters) {
    const owner = dominantModule(members, moduleIds)
    const holder = members.length > 1 ? nodeId('page-cluster', segment) : null
    if (holder) {
      nodes.push(
        makeNode({
          id: holder,
          type: 'page-cluster',
          name: segment,
          summary: `${members.length} screens under ${segment}.`,
          path: commonFolder(members.map((m) => m.route.file)),
          module: owner ?? siteId,
        }),
      )
      edges.push(makeEdge({ from: owner ?? siteId, to: holder, type: 'contains' }))
    }
    for (const { route, modules } of members) {
      const id = nodeId('screen', route.url)
      nodes.push(screenNode(route, modules, owner ?? siteId))
      screenByFile.set(route.file, id)
      edges.push(makeEdge({ from: holder ?? owner ?? siteId, to: id, type: 'contains' }))
      for (const target of modules) edges.push(makeEdge({ from: id, to: target, type: 'uses' }))
      if (modules.length === 0) {
        gaps.push({
          kind: 'screen-no-module',
          node: id,
          message: `${route.url} imports no module entry point, so no module note covers it`,
        })
      }
    }
  }

  for (const page of adminPages) {
    const id = nodeId('screen', page.url)
    nodes.push(
      makeNode({
        id,
        type: 'screen',
        name: page.url,
        summary: 'The Payload Admin app, where editors change every content type.',
        path: page.file,
        module: nodeId('platform-area', 'payload'),
        facts: [{ label: 'Address', value: page.url }],
      }),
    )
    screenByFile.set(page.file, id)
    edges.push(makeEdge({ from: nodeId('platform-area', 'payload'), to: id, type: 'contains' }))
    for (const target of contentTypeIds) {
      const [kind, slug] = target.split(':')
      edges.push(
        makeEdge({
          from: id,
          to: target,
          type: 'edits',
          via: [`/admin/${kind === 'global' ? 'globals' : 'collections'}/${slug}`],
        }),
      )
    }
  }
  return { nodes, edges, gaps, screenByFile }
}
