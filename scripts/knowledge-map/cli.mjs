#!/usr/bin/env node
/**
 * The system map scanner (#1462).
 *
 *   npm run knowledge:map                  write docs/knowledge/graph.json and docs/knowledge/catalog.md
 *   npm run knowledge:map -- --check       fail when the committed files are not what the sources give
 *   npm run knowledge:map -- --extras      write the change history and the open-issue snapshot to
 *                                          .knowledge-map/ (read by the map page; never committed)
 *
 * Run through `tsx`, as `npm run docs:generate` is, because it loads the Payload config. Same inputs,
 * same files, byte for byte: nothing here reads the clock, the network or git history, except
 * `--extras`, which exists for exactly that.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import prettier from 'prettier'

import { renderCatalog } from './catalog.mjs'
import { writeExtras, runCommand } from './extras.mjs'
import { scanGraph } from './scan.mjs'

export const GRAPH_FILE = 'docs/knowledge/graph.json'
export const CATALOG_FILE = 'docs/knowledge/catalog.md'
const COMMAND = 'npm run knowledge:map'

/** The two generated files as text, formatted the way the repository's Prettier formats them. */
export async function renderOutputs(graph, root) {
  const config = (await prettier.resolveConfig(path.join(root, GRAPH_FILE))) ?? {}
  const format = (text, parser) => prettier.format(text, { ...config, plugins: [], parser })
  return {
    [GRAPH_FILE]: await format(JSON.stringify(graph), 'json'),
    [CATALOG_FILE]: await format(renderCatalog(graph), 'markdown'),
  }
}

const readIfThere = (root, file) => {
  const full = path.join(root, file)
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : null
}

function printGaps(graph, log) {
  const byKind = new Map()
  for (const gap of graph.gaps) byKind.set(gap.kind, (byKind.get(gap.kind) ?? 0) + 1)
  log(
    `Gaps: ${graph.gaps.length} (${[...byKind].map(([kind, n]) => `${kind} ${n}`).join(', ') || 'none'})`,
  )
  for (const gap of graph.gaps) log(`  gap [${gap.kind}] ${gap.node}: ${gap.message}`)
}

/**
 * Runs the command in `root` and returns the exit code. `load(root)` gives the scan's inputs;
 * `run` runs git and gh for `--extras`; `date` is the snapshot's day.
 */
export async function execute({ argv, root, load, log = console.log, run = runCommand, date }) {
  if (argv.includes('--extras')) {
    const graph = JSON.parse(readIfThere(root, GRAPH_FILE) ?? '{"nodes":[]}')
    const result = writeExtras({
      root,
      graph,
      run,
      date: date ?? new Date().toISOString().slice(0, 10),
    })
    log(
      `Extras written: history ${result.history ? 'read' : 'empty'}, issue snapshot ${result.snapshot ? 'read' : 'empty'}.`,
    )
    return 0
  }
  const { graph, errors } = scanGraph(await load(root))
  for (const error of errors) log(`error [${error.rule}] ${error.node}: ${error.message}`)
  if (errors.length > 0) {
    log(`${errors.length} error${errors.length === 1 ? '' : 's'}: nothing written.`)
    return 1
  }
  printGaps(graph, log)
  const outputs = await renderOutputs(graph, root)
  if (argv.includes('--check')) {
    const stale = Object.keys(outputs).filter((file) => readIfThere(root, file) !== outputs[file])
    for (const file of stale)
      log(`${file} is out of date: run \`${COMMAND}\` and commit the result.`)
    if (stale.length === 0)
      log(
        `The system map data is current (${graph.nodes.length} nodes, ${graph.edges.length} relationships).`,
      )
    return stale.length === 0 ? 0 : 1
  }
  for (const [file, text] of Object.entries(outputs)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    fs.writeFileSync(path.join(root, file), text)
  }
  log(
    `Wrote ${GRAPH_FILE} and ${CATALOG_FILE} (${graph.nodes.length} nodes, ${graph.edges.length} relationships).`,
  )
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
  const { loadInputs } = await import('./load.mjs')
  process.exitCode = await execute({ argv: process.argv.slice(2), root, load: loadInputs })
}
