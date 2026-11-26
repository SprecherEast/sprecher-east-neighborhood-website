/**
 * The thin reader of the scanner (#1462): the files of the repository, a way to read one, and the
 * inputs that come straight from files (the schema, the map, package.json, the routes). The facts
 * that need the loaded Payload config and the compiler are loaded by the command, not here.
 */
import fs from 'node:fs'
import path from 'node:path'

import { KNOWLEDGE_MAP } from '../agent-context-maps.mjs'
import { listFiles } from '../knowledge-structure/cli.mjs'
import { ROUTES_ROOT, collectRoutes } from '../reference/routes.mjs'

const SCHEMA = 'docs/knowledge/note-schema.json'

/** `{ schema, files, read, mapJson, packageJson, routes }` for the repository at `root`. */
export function readRepository(root) {
  const files = listFiles(root).sort()
  const read = (file) => {
    const full = path.join(root, file)
    return fs.existsSync(full) && fs.statSync(full).isFile()
      ? fs.readFileSync(full, 'utf8')
      : undefined
  }
  return {
    schema: JSON.parse(read(SCHEMA)),
    files,
    read,
    mapJson: read(KNOWLEDGE_MAP),
    packageJson: JSON.parse(read('package.json')),
    // The rows name their file from the routes folder; the graph wants the path from the repository root
    routes: collectRoutes(root).map((row) => ({ ...row, file: `${ROUTES_ROOT}/${row.file}` })),
  }
}
